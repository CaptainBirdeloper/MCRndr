import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, MotionConfig } from 'motion/react';
import { Viewport } from './components/Viewport';
import { LeftSidebar } from './components/sidebar/LeftSidebar';
import { CameraDropdown } from './components/camera/CameraDropdown';
import { ViewportGuides } from './components/world/ViewportGuides';
import { GuidesCard } from './components/sidebar/GuidesCard';
import { ExportModal } from './components/modals/ExportModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { FloatingLightModal } from './components/modals/FloatingLightModal';
import { CanvasContextMenu } from './components/context/CanvasContextMenu';
import { MAX_PLAYERS } from './engine/players/playerManager';
import { loadSettings, saveSettings } from './utils/settings';
import { SceneStage } from './engine/render/scene';
import { applySettingsToStage } from './engine/render/applyUserSettings';
import { BodyPartName, ShaderPassMode, LightItem, PlayerItem } from './types';
import { POSE_PRESETS } from './presets/poses';

export function App() {
  const [stage, setStage] = useState<SceneStage | null>(null);
  const [players, setPlayers] = useState<PlayerItem[]>([]);
  const [activePlayerId, setActivePlayerId] = useState<string>('');
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuPlayerId, setContextMenuPlayerId] = useState<string | null>(null);
  const skinFileInputRef = useRef<HTMLInputElement>(null);
  const pendingSkinPlayerIdRef = useRef<string | null>(null);
  // Where the right-click landed on the floor; the next "+ Add Player" spawns there
  const contextMenuSpawnRef = useRef<{ x: number; z: number } | null>(null);
  const [selectedPart, setSelectedPart] = useState<BodyPartName | null>(null);
  const [, setRotationDeg] = useState<[number, number, number]>([0, 0, 0]);
  const [activePoseId, setActivePoseId] = useState<string | null>(null);
  const [shaderPass] = useState<ShaderPassMode>('beauty');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [showThirds, setShowThirds] = useState<boolean>(() => loadSettings().showThirds);
  const [showCenterGuide, setShowCenterGuide] = useState<boolean>(() => loadSettings().showCenterGuide);

  const toggleGuides = (key: 'showThirds' | 'showCenterGuide', next: boolean) => {
    saveSettings({ ...loadSettings(), [key]: next });
  };

  // Restore persisted general settings on boot, not only when Settings modal opens.
  useEffect(() => {
    if (stage) applySettingsToStage(stage, loadSettings());
  }, [stage]);

  const toggleThirds = () => {
    const next = !showThirds;
    setShowThirds(next);
    toggleGuides('showThirds', next);
  };

  const toggleCenterGuide = () => {
    const next = !showCenterGuide;
    setShowCenterGuide(next);
    toggleGuides('showCenterGuide', next);
  };
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [settingsOrigin, setSettingsOrigin] = useState<{ x: number; y: number } | null>(null);
  const [uiZoom, setUiZoom] = useState<number>(() => loadSettings().uiZoom);
  const [showHUD, setShowHUD] = useState<boolean>(true);
  const [activeLight, setActiveLight] = useState<LightItem | null>(null);
  const [lightScreenPos, setLightScreenPos] = useState<{ x: number; y: number } | null>(null);
  // Floating light modal is right-click only; left-click selection never opens it.
  const [lightModalId, setLightModalId] = useState<string | null>(null);

  // Delete-key target: the most recent explicit selection across the three object kinds.
  const lastSelectionRef = useRef<{ kind: 'light' | 'camera' | 'player'; id: string } | null>(null);
  const prevLightIdRef = useRef<string | null>(null);
  const prevCameraIdRef = useRef<string | null>(null);
  const prevPlayerIdRef = useRef<string>('');

  useEffect(() => {
    if (!stage) return;
    stage.controlsManager.setOnUndoListener(() => {
      setActivePoseId(null);
    });
    stage.controlsManager.setOnTransformListener(() => {
      setActivePoseId(null);
    });
  }, [stage]);

  useEffect(() => {
    if (!stage) return;
    const params = new URLSearchParams(window.location.search);
    const selectLightParam = params.get('selectLight');
    if (selectLightParam) {
      stage.lightingManager.selectLight(selectLightParam);
    }
    const intensityParam = params.get('lightIntensity');
    if (intensityParam && selectLightParam) {
      // EDGE CASE: parseFloat(intensityParam) can evaluate to NaN for non-numeric query values, corrupting light calculations
      stage.lightingManager.setLightIntensity(selectLightParam, parseFloat(intensityParam));
    }
    if (params.get('addCamera') === '1') {
      stage.controlsManager.addCamera();
    }
  }, [stage]);

  useEffect(() => {
    if (!stage) return;
    const lm = stage.lightingManager;

    const updateActiveLight = (lights: LightItem[], activeId: string | null) => {
      if (activeId && activeId !== prevLightIdRef.current) {
        lastSelectionRef.current = { kind: 'light', id: activeId };
      }
      if (!activeId || activeId !== prevLightIdRef.current) {
        setLightModalId(null);
      }
      prevLightIdRef.current = activeId;
      const found = lights.find((l) => l.id === activeId) || null;
      setActiveLight(found);
    };

    lm.setChangeListener(updateActiveLight);
    stage.controlsManager.setLightContextListener((id) => setLightModalId(id));

    let animId: number;
    const trackLightPos = () => {
      const activeId = lm.getActiveLightId();
      if (activeId) {
        const pos = lm.getLightScreenPosition(activeId, stage.camera, window.innerWidth, window.innerHeight);
        if (pos && pos.visible) {
          setLightScreenPos({ x: pos.x, y: pos.y });
        } else {
          setLightScreenPos(null);
        }
      } else {
        setLightScreenPos(null);
      }
      animId = requestAnimationFrame(trackLightPos);
    };
    animId = requestAnimationFrame(trackLightPos);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [stage]);

  useEffect(() => {
    if (!stage) return;
    const pm = stage.players;
    const sync = (list: PlayerItem[], activeId: string) => {
      if (activeId && activeId !== prevPlayerIdRef.current) {
        lastSelectionRef.current = { kind: 'player', id: activeId };
      }
      prevPlayerIdRef.current = activeId;
      setPlayers(list);
      setActivePlayerId(activeId);
    };
    pm.setChangeListener(sync);
    return () => pm.removeChangeListener(sync);
  }, [stage]);

  useEffect(() => {
    if (!stage) return;
    const cm = stage.controlsManager;
    const onCameraChange = (_items: unknown, activeId: string | null) => {
      if (activeId && activeId !== prevCameraIdRef.current) {
        lastSelectionRef.current = { kind: 'camera', id: activeId };
      }
      prevCameraIdRef.current = activeId;
    };
    cm.setCameraChangeListener(onCameraChange);
    return () => cm.removeCameraChangeListener?.(onCameraChange);
  }, [stage]);

  useEffect(() => {
    if (!stage) return;
    const handleDeleteKey = (e: KeyboardEvent) => {
      if (e.code !== 'Delete' && e.code !== 'Backspace') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (showExportModal || showSettingsModal) return;
      const selection = lastSelectionRef.current;
      if (!selection) return;
      e.preventDefault();
      if (selection.kind === 'light') {
        stage.lightingManager.removeLight(selection.id);
      } else if (selection.kind === 'camera') {
        stage.controlsManager.deleteCamera(selection.id);
      } else {
        stage.players.deletePlayer(selection.id);
      }
      // Selection listeners fire synchronously during the delete and would re-arm the
      // fallback object; clear afterwards so one keypress deletes exactly one object.
      lastSelectionRef.current = null;
    };
    window.addEventListener('keydown', handleDeleteKey);
    return () => window.removeEventListener('keydown', handleDeleteKey);
  }, [stage, showExportModal, showSettingsModal]);

  useEffect(() => {
    setActivePoseId(null);
  }, [activePlayerId]);

  useEffect(() => {
    if (!stage) return;
    const handlePlayerHotkey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const match = /^Digit([1-8])$/.exec(e.code);
      if (!match) return;
      const target = stage.players.getPlayers()[Number(match[1]) - 1];
      if (target) {
        e.preventDefault();
        stage.players.selectPlayer(target.id);
      }
    };
    window.addEventListener('keydown', handlePlayerHotkey);
    return () => window.removeEventListener('keydown', handlePlayerHotkey);
  }, [stage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'KeyH') {
        setShowHUD((prev) => !prev);
        setContextMenuPos(null);
      }
      if (e.code === 'KeyL' && e.shiftKey) {
        e.preventDefault();
        // EDGE CASE: a plain fetch rejection here would surface as an unhandled promise
        // rejection right as the server dies, so swallow it
        if (import.meta.env.DEV) void fetch('/__shutdown', { method: 'POST' }).catch(() => {});
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePoseSelect = (id: string) => {
    if (!stage) return;

    const canonical = POSE_PRESETS.find((p) => p.id === id);
    if (canonical) {
      stage.controlsManager.applyPose(canonical);
      setActivePoseId(id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!stage) return;
    // EDGE CASE: a right-click during a cursor-grab must not stack a menu over the drag
    if (stage.controlsManager.isModalActive()) {
      setContextMenuPos(null);
      setContextMenuPlayerId(null);
      contextMenuSpawnRef.current = null;
      return;
    }
    // One depth-sorted pick decides both suppression and the skin target, so a glyph
    // behind a player can no longer hide that player's menu
    const pick = stage.controlsManager.pickObjectAt(e.clientX, e.clientY);
    if (pick?.kind === 'light') {
      setContextMenuPos(null);
      setContextMenuPlayerId(null);
      contextMenuSpawnRef.current = null;
      stage.lightingManager.selectLight(pick.id);
      setLightModalId(pick.id);
      return;
    }
    setLightModalId(null);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setContextMenuPlayerId(pick?.kind === 'player' ? pick.id : null);
    contextMenuSpawnRef.current = stage.controlsManager.pickGroundPoint(e.clientX, e.clientY);
  };

  const handleSkinFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const playerId = pendingSkinPlayerIdRef.current;
    e.target.value = '';
    if (!file || !stage || !playerId) return;
    try {
      await stage.loadSkinFile(file, playerId);
    } catch {
      // EDGE CASE: corrupt PNG rejects the decode, and the menu is already gone by then
    }
  };

  const activePlayer = players.find((p) => p.id === activePlayerId) ?? players[0] ?? null;
  const skinName = activePlayer?.skinName ?? null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative w-screen h-screen bg-[#07050F] text-white font-['Rethink_Sans'] select-none overflow-hidden">
        <main className="w-full h-full absolute inset-0">
          <Viewport
            onStageReady={setStage}
            onContextMenu={handleContextMenu}
            onSelectionChange={(part, deg) => {
              setSelectedPart(part);
              setRotationDeg(deg);
            }}
          />
        </main>

        {showHUD && (
          <ViewportGuides showThirds={showThirds} showCenter={showCenterGuide} />
        )}

        {showHUD && (
          <div
            style={{ zoom: `${uiZoom}%` }}
            className="absolute inset-0 pointer-events-none z-40 [&>*]:pointer-events-auto"
          >
            <CameraDropdown stage={stage} />

            <LeftSidebar
              stage={stage}
              skinName={skinName}
              activePoseId={activePoseId}
              selectedPart={selectedPart}
              onPoseSelect={handlePoseSelect}
              guidesCard={
                <GuidesCard
                  showThirds={showThirds}
                  showCenterGuide={showCenterGuide}
                  onToggleThirds={toggleThirds}
                  onToggleCenterGuide={toggleCenterGuide}
                />
              }
              onOpenExport={() => setShowExportModal(true)}
              onOpenSettings={(origin) => {
                setSettingsOrigin(origin);
                setShowSettingsModal(true);
              }}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
            />
          </div>
        )}

        <AnimatePresence>
          {showExportModal && (
            <ExportModal
              key="export-modal"
              stage={stage}
              activePass={shaderPass}
              onClose={() => setShowExportModal(false)}
            />
          )}
        </AnimatePresence>

        {showHUD && contextMenuPos && (
          <CanvasContextMenu
            x={contextMenuPos.x}
            y={contextMenuPos.y}
            canAdd={players.length < MAX_PLAYERS}
            onAdd={() => {
              stage?.players.createPlayer(contextMenuSpawnRef.current ?? undefined);
              stage?.controlsManager.framePlayersIfNeeded();
            }}
            canChangeSkin={contextMenuPlayerId !== null}
            showThirds={showThirds}
            showCenterGuide={showCenterGuide}
            onToggleThirds={toggleThirds}
            onToggleCenterGuide={toggleCenterGuide}
            onChangeSkin={() => {
              pendingSkinPlayerIdRef.current = contextMenuPlayerId;
              skinFileInputRef.current?.click();
            }}
            onClose={() => {
              setContextMenuPos(null);
              setContextMenuPlayerId(null);
            }}
          />
        )}

        <input
          ref={skinFileInputRef}
          type="file"
          accept="image/png"
          className="hidden"
          onChange={handleSkinFileChange}
        />

        {activeLight && lightScreenPos && lightModalId === activeLight.id && (
          <FloatingLightModal
            light={activeLight}
            position={lightScreenPos}
            onUpdate={(id, patch) => stage?.lightingManager.updateLight(id, patch)}
            onClose={() => stage?.lightingManager.selectLight(null)}
          />
        )}

        <AnimatePresence>
          {showSettingsModal && (
            <SettingsModal
              key="settings-modal"
              isOpen={showSettingsModal}
              onClose={() => setShowSettingsModal(false)}
              origin={settingsOrigin}
              stage={stage}
              onSettingsChange={(s) => setUiZoom(s.uiZoom)}
            />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

export default App;
