import { AnimatePresence } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rarityOf } from '../shared/aircraft';
import { CLUSTER_CENTER, CLUSTER_NAMES } from '../shared/coverage';
import { inBBox, type BBox } from '../shared/geo';
import { BottomBar } from './components/BottomBar';
import { BountyBanner } from './components/BountyBanner';
import { CatchBurst } from './components/CatchBurst';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FlightMap, type FlyRequest } from './components/FlightMap';
import { FlightPanel } from './components/FlightPanel';
import { Header } from './components/Header';
import { Logbook } from './components/Logbook';
import { MissionBar } from './components/MissionBar';
import { MissionResults, type MissionOutcome } from './components/MissionResults';
import { MissionTag } from './components/MissionTag';
import { Notices, type Notice } from './components/Notices';
import { Onboarding } from './components/Onboarding';
import { PackOpener } from './components/PackOpener';
import { QuestTray } from './components/QuestTray';
import { ShinyReveal } from './components/ShinyReveal';
import { useAirspace } from './hooks/useAirspace';
import { useClock } from './hooks/useClock';
import { updateBounties, type Bounty } from './game/bounties';
import {
  accuracy,
  currentGoal,
  isOver,
  missionStep,
  startMission,
  timeLeftMs,
  type Contact,
  type MissionState,
} from './game/mission';
import { COMBO_WINDOW_MS, NO_COMBO, nextCombo, recordFor, squawkAlert, type CatchRecord, type Combo } from './game/rules';
import {
  addPackCards,
  catchAircraft,
  completeTutorial,
  getGame,
  isCaught,
  recordEscape,
  setSoundOn,
  settleShift,
  useGame,
  type CatchOutcome,
} from './game/store';
import {
  haptic,
  playBountySound,
  playCatchSound,
  playEscapeSound,
  playLossSound,
  playSiren,
  playSpawnSound,
  playWinSound,
  setMuted,
  unlockAudio,
} from './game/sound';
import { pullPack } from './game/packs';
import { simulatedSky } from './lib/simulated';
import { matchesFilter } from './lib/filter';
import { thinForZoom, type Blip } from './lib/flights';

const FRAME_MS = 1000;
const SPAWN_TOAST_GAP_MS = 8_000;
const SEEN_CAP = 5_000;
const MISSION_CONTACT_CAP = 220;
// Europe at a zoom where data and planes are obvious: the intro lands here
const INTRO_VIEW: FlyRequest = { id: 0, center: [12, 46], zoom: 4.2 };

/** What the mission needs to know about a contact. Deliberately the same fields the tag reveals. */
function toContact(b: Blip): Contact {
  return { hex: b.hex, type: b.type, category: b.category, alt: b.alt, squawk: b.squawk };
}

/** The region with the most real aircraft right now, so a mission starts somewhere busy. */
function busiestRegion(real: Blip[]): [number, number] {
  let best = CLUSTER_CENTER[CLUSTER_NAMES[0]];
  let bestCount = -1;
  for (const c of CLUSTER_NAMES) {
    const [lon, lat] = CLUSTER_CENTER[c];
    const count = real.filter((b) => Math.abs(b.lon - lon) < 20 && Math.abs(b.lat - lat) < 15).length;
    if (count > bestCount) {
      bestCount = count;
      best = CLUSTER_CENTER[c];
    }
  }
  return best;
}

export default function App() {
  const game = useGame();
  const now = useClock(FRAME_MS);
  const [bbox, setBbox] = useState<BBox | null>(null);
  const [zoom, setZoom] = useState(INTRO_VIEW.zoom);
  const { blips, trails, status, dataAgeMs, coverage } = useAirspace(bbox);

  // Regions without verified live data get simulated traffic, clearly marked and not catchable
  const darkClusters = useMemo(
    () => (coverage ? CLUSTER_NAMES.filter((c) => !coverage.clusters[c]) : [...CLUSTER_NAMES]),
    [coverage],
  );
  // Anchored to a fixed fix time, so the sky is deterministic. Projection is capped, so it drifts a fixed amount.
  const simulated = useMemo(() => simulatedSky(darkClusters, 0), [darkClusters]);
  const warming = coverage && coverage.ready ? null : { live: coverage?.live ?? 0, total: CLUSTER_NAMES.length };

  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [flyRequest, setFlyRequest] = useState<FlyRequest | null>(INTRO_VIEW);
  const [filter, setFilter] = useState<string | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [burst, setBurst] = useState<CatchOutcome | null>(null);
  const [shiny, setShiny] = useState<CatchRecord | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [combo, setCombo] = useState<Combo>(NO_COMBO);
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [packPull, setPackPull] = useState<CatchRecord[] | null>(null);

  // Two-minute mission: the high-score game. While it runs, the map shows only real contacts, masked.
  const [mission, setMission] = useState<MissionState | null>(null);
  const [debrief, setDebrief] = useState<MissionOutcome | null>(null);

  const inMission = mission !== null;

  const visible = useMemo(() => {
    if (inMission) return blips;
    const sim = bbox ? simulated.filter((b) => inBBox(b.lat, b.lon, bbox)) : simulated;
    const all = [...blips, ...sim];
    return filter ? all.filter((b) => matchesFilter(b, filter)) : all;
  }, [blips, simulated, bbox, filter, inMission]);
  // Density is a zoom concern: at world scale only rare-or-better aircraft are drawn in full.
  // A mission caps contacts to the nearest ones, so a round stays readable and fair.
  const shown = useMemo(() => {
    if (!inMission) return thinForZoom(visible, zoom);
    if (!bbox) return visible.slice(0, MISSION_CONTACT_CAP);
    const cx = (bbox.west + bbox.east) / 2;
    const cy = (bbox.south + bbox.north) / 2;
    const dist = (b: Blip) => (b.lon - cx) ** 2 + (b.lat - cy) ** 2;
    return [...visible].sort((a, b) => dist(a) - dist(b)).slice(0, MISSION_CONTACT_CAP);
  }, [visible, zoom, inMission, bbox]);
  const mapTrails = useMemo(() => (inMission ? new Map() : trails), [trails, inMission]);

  const selected = useMemo(() => blips.find((b) => b.hex === selectedHex) ?? null, [blips, selectedHex]);
  const caughtRecord = useMemo(
    () => (selected ? game.records.find((r) => r.hex === selected.hex) : undefined),
    [game.records, selected],
  );
  const visibleHexes = useMemo(() => new Set(blips.map((b) => b.hex)), [blips]);
  const liveCombo = now - combo.last > COMBO_WINDOW_MS ? NO_COMBO : combo;

  const seen = useRef<Set<string>>(new Set());
  const alerted = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const bountiesRef = useRef<Bounty[]>([]);
  const bountyPrimed = useRef(false);
  const lastSpawnToast = useRef(0);

  const flyTo = useCallback((center: [number, number], zoomLevel: number) => {
    setFlyRequest((prev) => ({ id: (prev?.id ?? 0) + 1, center, zoom: zoomLevel }));
  }, []);

  const pushNotice = useCallback((n: Omit<Notice, 'id'>) => {
    setNotices((prev) => [...prev.slice(-3), { ...n, id: Date.now() + Math.random() }]);
  }, []);
  const dismissNotice = useCallback((id: number) => setNotices((prev) => prev.filter((n) => n.id !== id)), []);
  const clearBurst = useCallback(() => setBurst(null), []);

  // Audio needs a gesture to start: unlock on the first press anywhere
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => setMuted(!game.soundOn), [game.soundOn]);

  // Spawns and squawk alerts: anything new in view can announce itself (real aircraft only)
  useEffect(() => {
    if (blips.length === 0) return;
    const fresh = blips.filter((b) => !seen.current.has(b.hex));
    for (const b of blips) seen.current.add(b.hex);
    if (seen.current.size > SEEN_CAP) seen.current = new Set(blips.map((b) => b.hex));

    // The first batch is the existing sky, not a surprise
    if (!primed.current) {
      primed.current = true;
      return;
    }

    if (!inMission) {
      for (const b of fresh) {
        const alert = squawkAlert(b.squawk);
        if (!alert || alerted.current.has(b.hex)) continue;
        alerted.current.add(b.hex);
        playSiren();
        pushNotice({ kind: 'alert', title: `Squawk ${b.squawk} · ${alert}`, body: `${b.callsign} is in view` });
        break;
      }
    }

    const rare = fresh.find((b) => {
      const r = rarityOf(b.type, b.category);
      return r === 'epic' || r === 'legendary';
    });
    if (rare && !inMission && Date.now() - lastSpawnToast.current > SPAWN_TOAST_GAP_MS) {
      lastSpawnToast.current = Date.now();
      playSpawnSound(rarityOf(rare.type, rare.category));
      pushNotice({ kind: 'info', title: `${rare.type} spotted`, body: `${rare.callsign} just entered view` });
    }
  }, [blips, pushNotice, inMission]);

  // Bounties: rare planes become chases. Losing one to the edge of the view is a real loss.
  useEffect(() => {
    if (status !== 'live' || inMission) return;
    const caught = new Set(getGame().records.map((r) => r.hex));
    const sightings = blips.map((b) => ({ hex: b.hex, callsign: b.callsign, type: b.type, category: b.category }));
    const update = updateBounties(bountiesRef.current, sightings, caught, Date.now());
    if (!bountyPrimed.current) {
      bountyPrimed.current = true;
      bountiesRef.current = update.active;
      setBounties(update.active);
      return;
    }
    bountiesRef.current = update.active;
    setBounties(update.active);
    for (const e of update.escaped) {
      recordEscape();
      playEscapeSound();
      pushNotice({ kind: 'info', title: 'Bounty escaped', body: `${e.callsign} left the view before you caught it` });
    }
    for (const s of update.spotted) {
      playBountySound();
      pushNotice({ kind: 'info', title: 'New bounty', body: `${s.type ?? 'Rare aircraft'} · ${s.callsign}` });
    }
  }, [blips, status, pushNotice, inMission]);

  // Shift clock (legacy shifts): settles any shift still running
  useEffect(() => {
    const id = window.setInterval(() => {
      const lesson = settleShift();
      if (lesson) {
        playLossSound();
        pushNotice({ kind: 'info', title: 'Shift lost', body: lesson });
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [pushNotice]);

  // ---- Two-minute mission -------------------------------------------------

  const finishMission = useCallback((m: MissionState) => {
    setDebrief({
      score: m.score,
      accuracy: accuracy(m),
      bestStreak: m.bestStreak,
      correct: m.correct,
      wrong: m.wrong,
      goalsCompleted: m.goalsCompleted,
    });
    setMission(null);
    setSelectedHex(null);
    setBounties([]);
    bountiesRef.current = [];
  }, []);

  // The round ends on its own clock. Checked twice a second, so the debrief lands within a moment of zero.
  useEffect(() => {
    if (!mission) return;
    const id = window.setInterval(() => {
      if (isOver(mission, Date.now())) finishMission(mission);
    }, 500);
    return () => window.clearInterval(id);
  }, [mission, finishMission]);

  function startRound() {
    unlockAudio();
    const real = blips.filter((b) => !b.simulated);
    const at = Date.now();
    setMission(startMission(at, Math.floor(at / 1000)));
    setDebrief(null);
    setSelectedHex(null);
    setFilter(null);
    setWalletOpen(false);
    flyTo(busiestRegion(real), 4.2);
  }

  /** One decision on the open contact: log it or pass. Then the next contact can be opened. */
  const decide = useCallback(
    (type: 'log' | 'pass') => {
      if (!mission || !selected || selected.simulated) return;
      const at = Date.now();
      const next = missionStep(mission, { type, contact: toContact(selected) }, at);
      if (next === mission) return;
      setMission(next);
      setSelectedHex(null);
      if (type === 'log') {
        if (next.correct > mission.correct) {
          if (game.soundOn) playCatchSound('common', next.streak);
          haptic(20);
        } else {
          playEscapeSound();
          haptic([40, 60, 40]);
        }
      }
      if (next.goalsCompleted > mission.goalsCompleted && game.soundOn) playWinSound();
    },
    [mission, selected, game.soundOn],
  );

  // Keys for the open contact: L logs, P passes, Escape closes the tag
  useEffect(() => {
    if (!mission) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'l' || e.key === 'L') decide('log');
      if (e.key === 'p' || e.key === 'P') decide('pass');
      if (e.key === 'Escape') setSelectedHex(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mission, decide]);

  // ---- Patrol (open-ended play) -------------------------------------------

  function handleCatch(blip: Blip) {
    if (blip.simulated) {
      pushNotice({
        kind: 'info',
        title: 'Simulated traffic',
        body: 'Live data for this region is still warming up. Real aircraft here become catchable once verified.',
      });
      return;
    }
    if (isCaught(blip.hex)) return;
    const next = nextCombo(liveCombo, Date.now());
    const outcome = catchAircraft(blip, Date.now(), next.multiplier);
    if (!outcome) return;

    setCombo(next);
    if (game.soundOn) {
      if (outcome.shiftResult === 'won') playWinSound();
      else playCatchSound(outcome.record.rarity, next.multiplier);
    }
    haptic(outcome.record.rarity === 'legendary' ? [30, 40, 30, 40, 80] : 40);
    if (outcome.shiftResult === 'won') setShiny(outcome.record);
    else setBurst(outcome);

    if (next.multiplier > liveCombo.multiplier && next.multiplier > 1) {
      pushNotice({ kind: 'info', title: `Combo x${next.multiplier}!`, body: `${next.chain} catches in a row` });
    }
    if (outcome.levelUp) pushNotice({ kind: 'level', title: `Level ${outcome.levelUp}`, body: 'You climbed a rank' });
    for (const a of outcome.achievements) {
      pushNotice({ kind: 'achievement', title: a.title, body: `${a.description} · +30 XP` });
    }
    for (const q of outcome.quests) {
      pushNotice({ kind: 'quest', title: 'Quest complete', body: `${q.title} · +50 XP` });
    }
    for (const w of outcome.weekly) {
      pushNotice({ kind: 'achievement', title: 'Weekly goal met', body: `${w.title} · +150 XP` });
    }
    for (const s of outcome.sets) {
      pushNotice({ kind: 'achievement', title: `Set complete: ${s.title}`, body: `${s.blurb} · +150 XP` });
    }
  }

  function handleOpenPack() {
    const pool = blips.filter((b) => !isCaught(b.hex) && !b.simulated);
    const pulled = pullPack(pool);
    if (pulled.length === 0) {
      pushNotice({ kind: 'info', title: 'Nothing to pull', body: 'Wait for more aircraft in view, then open the pack' });
      return;
    }
    const at = Date.now();
    const hour = new Date(at).getHours();
    setWalletOpen(false);
    setPackPull(pulled.map((b) => ({ ...recordFor(b, at, hour), source: 'pack' as const })));
  }

  function handleConfirmPack(records: CatchRecord[]) {
    addPackCards(records);
    setPackPull(null);
    pushNotice({ kind: 'achievement', title: `${records.length} cards added`, body: 'Open your wallet to see them' });
  }

  /** A callsign jumps to that flight. Anything else filters the map by type, so you can hunt a target. */
  function handleSearch(query: string) {
    const q = query.trim().toUpperCase();
    const hit = blips.find((b) => b.callsign.toUpperCase().startsWith(q));
    if (hit) {
      setFilter(null);
      setSelectedHex(hit.hex);
      flyTo([hit.lon, hit.lat], 7);
      return;
    }
    setFilter(q);
  }

  function focusBounty(hex: string) {
    const hit = blips.find((b) => b.hex === hex);
    if (!hit) return;
    setSelectedHex(hex);
    flyTo([hit.lon, hit.lat], 7);
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => flyTo([pos.coords.longitude, pos.coords.latitude], 6),
      () => pushNotice({ kind: 'info', title: 'No location', body: 'Allow location to find your sky' }),
    );
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || mission) return;
      if (walletOpen) setWalletOpen(false);
      else setSelectedHex(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [walletOpen, mission]);

  const goal = mission ? currentGoal(mission) : null;

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-ink">
      <FlightMap
        blips={shown}
        trails={mapTrails}
        selectedHex={selectedHex}
        masked={inMission}
        flyRequest={flyRequest}
        onSelect={setSelectedHex}
        onViewport={(b, z) => {
          setBbox(b);
          setZoom(z);
        }}
      />

      <ErrorBoundary name="HUD">
        <Header
          status={status}
          dataAgeMs={dataAgeMs}
          now={now}
          tracked={blips.length}
          warming={warming}
          filter={filter}
          onClearFilter={() => setFilter(null)}
          xp={game.xp}
          streak={game.streak}
          combo={liveCombo}
          inMission={inMission}
          soundOn={game.soundOn}
          onOpenWallet={() => setWalletOpen(true)}
          onToggleSound={() => setSoundOn(!game.soundOn)}
          onLocate={locate}
          onSearch={handleSearch}
          onStartMission={startRound}
        />
      </ErrorBoundary>

      {mission && goal && (
        <div className="pointer-events-none absolute inset-x-0 top-[4.5rem] z-10 flex justify-center px-3 md:top-16">
          <ErrorBoundary name="Mission bar">
            <MissionBar
              timeLeftMs={timeLeftMs(mission, now)}
              goalTitle={goal.title}
              progress={mission.progress}
              need={goal.need}
              score={mission.score}
              streak={mission.streak}
              onEnd={() => finishMission(mission)}
            />
          </ErrorBoundary>
        </div>
      )}

      {!inMission && (
        <div className="pointer-events-none absolute left-3 top-[8.5rem] z-10 md:left-4 md:top-24">
          <ErrorBoundary name="Bounties">
            <BountyBanner bounties={bounties} visible={visibleHexes} now={now} onFocus={focusBounty} />
          </ErrorBoundary>
        </div>
      )}

      <BottomBar onRegion={(r) => flyTo(r.center, r.zoom)} />

      {!inMission && (
        <div className="pointer-events-none absolute inset-x-3 bottom-24 z-10 flex flex-col items-center gap-3 md:inset-x-auto md:bottom-4 md:left-4 md:items-start">
          <ErrorBoundary name="Quests">
            <QuestTray game={game} now={now} />
          </ErrorBoundary>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-3 bottom-24 z-10 flex justify-center md:inset-x-auto md:bottom-auto md:right-4 md:top-24">
        <ErrorBoundary name="Contact">
          {mission && selected && !selected.simulated && goal ? (
            <MissionTag
              key={selected.hex}
              blip={selected}
              target={goal.title}
              onLog={() => decide('log')}
              onPass={() => decide('pass')}
              onClose={() => setSelectedHex(null)}
            />
          ) : (
            !mission && (
              <AnimatePresence mode="wait">
                {selected && (
                  <FlightPanel
                    key={selected.hex}
                    blip={selected}
                    caught={caughtRecord}
                    onCatch={() => handleCatch(selected)}
                    onClose={() => setSelectedHex(null)}
                  />
                )}
              </AnimatePresence>
            )
          )}
        </ErrorBoundary>
      </div>

      <Notices notices={notices} onDismiss={dismissNotice} />
      <CatchBurst outcome={burst} onDone={clearBurst} />
      <ShinyReveal record={shiny} tierWon="Shift" onDone={() => setShiny(null)} />

      <AnimatePresence>
        {walletOpen && (
          <ErrorBoundary name="Wallet" key="wallet">
            <Logbook game={game} now={now} onClose={() => setWalletOpen(false)} onOpenPack={handleOpenPack} />
          </ErrorBoundary>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {packPull && (
          <PackOpener
            key="pack"
            records={packPull}
            soundOn={game.soundOn}
            onConfirm={handleConfirmPack}
            onCancel={() => setPackPull(null)}
          />
        )}
      </AnimatePresence>
      {debrief && (
        <ErrorBoundary name="Debrief">
          <MissionResults outcome={debrief} onPlayAgain={startRound} onExit={() => setDebrief(null)} />
        </ErrorBoundary>
      )}
      <AnimatePresence>
        {!game.tutorialDone && <Onboarding onDone={completeTutorial} />}
      </AnimatePresence>
    </main>
  );
}
