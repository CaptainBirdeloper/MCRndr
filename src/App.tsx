import { useState, useEffect } from 'react';
import { Viewport } from './components/Viewport';
import { LeftSidebar } from './components/sidebar/LeftSidebar';
import { CameraDropdown } from './components/camera/CameraDropdown';
import { ExportModal } from './components/modals/ExportModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { FloatingLightModal } from './components/modals/FloatingLightModal';
import { loadSettings } from './utils/settings';
import { SceneStage } from './engine/render/scene';
import { ArmType, BodyPartName, ShaderPassMode, LightItem } from './types';
import { POSE_PRESETS } from './presets/poses';

export function App() {
  const [stage, setStage] = useState<SceneStage | null>(null);
  const [, setArmType] = useState<ArmType>('steve');
  const [skinName, setSkinName] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<BodyPartName | null>(null);
  const [, setRotationDeg] = useState<[number, number, number]>([0, 0, 0]);
  const [activePoseId, setActivePoseId] = useState<string | null>(null);
  const [shaderPass] = useState<ShaderPassMode>('beauty');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [settingsOrigin, setSettingsOrigin] = useState<{ x: number; y: number } | null>(null);
  const [uiZoom, setUiZoom] = useState<number>(() => loadSettings().uiZoom);
  const [showHUD, setShowHUD] = useState<boolean>(true);
  const [activeLight, setActiveLight] = useState<LightItem | null>(null);
  const [lightScreenPos, setLightScreenPos] = useState<{ x: number; y: number } | null>(null);

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
    const styleParam = params.get('lightStyle');
    if (styleParam === 'minecrafty' || styleParam === 'realistic') {
      stage.lightingManager.setStyle(styleParam);
    }
    if (params.get('addCamera') === '1') {
      stage.controlsManager.addCamera();
    }
  }, [stage]);

  useEffect(() => {
    if (!stage) return;
    const lm = stage.lightingManager;

    const updateActiveLight = (lights: LightItem[], activeId: string | null) => {
      const found = lights.find((l) => l.id === activeId) || null;
      setActiveLight(found);
    };

    lm.setChangeListener(updateActiveLight);

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'KeyH') {
        setShowHUD((prev) => !prev);
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

  const handleSkinLoaded = (name: string, detectedArm: ArmType) => {
    // EDGE CASE: name may be undefined or null if file has no name, throwing TypeError on .replace()
    const cleanName = name.replace(/\.png$/i, '');
    setSkinName(cleanName);
    setArmType(detectedArm);
  };

  return (
    <div className="relative w-screen h-screen bg-[#07050F] text-white font-['Rethink_Sans'] select-none overflow-hidden">
      <main className="w-full h-full absolute inset-0">
        <Viewport
          onStageReady={setStage}
          onSkinLoaded={handleSkinLoaded}
          onSelectionChange={(part, deg) => {
            setSelectedPart(part);
            setRotationDeg(deg);
          }}
        />
      </main>

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
            onSkinLoaded={handleSkinLoaded}
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

      {showExportModal && (
        <ExportModal
          stage={stage}
          activePass={shaderPass}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {activeLight && lightScreenPos && (
        <FloatingLightModal
          light={activeLight}
          position={lightScreenPos}
          onIntensityChange={(id, val) => stage?.lightingManager.setLightIntensity(id, val)}
          onColorChange={(id, color) => stage?.lightingManager.setLightColor(id, color)}
          onToggleShadow={(id) => stage?.lightingManager.toggleLightShadow(id)}
          onClose={() => stage?.lightingManager.selectLight(null)}
        />
      )}

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        origin={settingsOrigin}
        stage={stage}
        onSettingsChange={(s) => setUiZoom(s.uiZoom)}
      />
    </div>
  );
}

export default App;
