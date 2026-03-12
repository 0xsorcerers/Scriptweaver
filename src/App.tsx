import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { buildAssets, buildScenes, createLocalFrame } from './lib/sceneBuilder';
import { loadProjects, saveProjects } from './lib/storage';
import { extractTextFromFile } from './lib/textExtractors';
import { ExternalConfig, PromptAsset, Scene, StoryProject } from './types';

const defaultExternal: ExternalConfig = {
  provider: 'grok',
  endpoint: '',
  model: '',
  apiKey: ''
};

function createProject(name: string): StoryProject {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    sourceText: '',
    characterAssets: [],
    environmentAssets: [],
    scenes: [],
    frameCache: {},
    imageMode: 'local',
    externalConfig: defaultExternal
  };
}

export function App() {
  const [projects, setProjects] = useState<StoryProject[]>(() => loadProjects());
  const [selectedId, setSelectedId] = useState<string>(projects[0]?.id ?? '');
  const [newProjectName, setNewProjectName] = useState('');
  const [rawText, setRawText] = useState('');
  const [status, setStatus] = useState('Ready. Create a project or select one.');

  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedId),
    [projects, selectedId]
  );

  function upsertProject(next: StoryProject) {
    setProjects((prev) => prev.map((item) => (item.id === next.id ? next : item)));
  }

  function handleCreateProject() {
    const name = newProjectName.trim();
    if (!name) return;
    const project = createProject(name);
    setProjects((prev) => [project, ...prev]);
    setSelectedId(project.id);
    setNewProjectName('');
    setRawText('');
    setStatus(`Project "${name}" created.`);
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await extractTextFromFile(file);
      setRawText(text);
      setStatus(`Loaded ${file.name}. ${text.length.toLocaleString()} characters extracted.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      setStatus(message);
    } finally {
      event.target.value = '';
    }
  }

  function handleIngestText() {
    if (!selectedProject) return;
    const sourceText = rawText.trim();
    if (!sourceText) {
      setStatus('Provide story text first.');
      return;
    }

    const { characterAssets, environmentAssets } = buildAssets(sourceText);
    const scenes = buildScenes(sourceText, characterAssets, environmentAssets);

    const nextProject: StoryProject = {
      ...selectedProject,
      sourceText,
      characterAssets,
      environmentAssets,
      scenes,
      frameCache: {}
    };

    upsertProject(nextProject);
    setStatus(`Ingested ${scenes.length} scenes with ${characterAssets.length} character prompts and ${environmentAssets.length} environment prompts.`);
  }

  function updateAsset(kind: 'characterAssets' | 'environmentAssets', assets: PromptAsset[]) {
    if (!selectedProject) return;
    upsertProject({ ...selectedProject, [kind]: assets });
  }

  function updateExternalConfig(field: keyof ExternalConfig, value: string) {
    if (!selectedProject) return;
    upsertProject({
      ...selectedProject,
      externalConfig: {
        ...selectedProject.externalConfig,
        [field]: value
      }
    });
  }

  async function generateStoryboard() {
    if (!selectedProject) return;
    if (!selectedProject.scenes.length) {
      setStatus('No scenes available. Ingest text first.');
      return;
    }

    const cache = { ...selectedProject.frameCache };
    const nextScenes: Scene[] = [];

    for (const scene of selectedProject.scenes) {
      const cached = cache[scene.prompt];
      if (cached) {
        nextScenes.push({ ...scene, imageDataUrl: cached });
        continue;
      }

      let frame: string;
      if (selectedProject.imageMode === 'local') {
        frame = createLocalFrame(scene.prompt, scene.id);
      } else {
        frame = await requestExternalFrame(scene.prompt, selectedProject.externalConfig);
      }

      cache[scene.prompt] = frame;
      nextScenes.push({ ...scene, imageDataUrl: frame });
    }

    upsertProject({ ...selectedProject, scenes: nextScenes, frameCache: cache });
    setStatus(`Generated ${nextScenes.length} storyboard cards in ${selectedProject.imageMode} mode.`);
  }

  return (
    <div className="layout">
      <aside>
        <h1>Scriptweaver</h1>
        <p className="muted">Local-first animation storyboard / storycard creator.</p>

        <div className="group">
          <input
            value={newProjectName}
            onChange={(event) => setNewProjectName(event.target.value)}
            placeholder="New project name"
          />
          <button onClick={handleCreateProject}>Create project</button>
        </div>

        <div className="project-list">
          {projects.map((project) => (
            <button
              key={project.id}
              className={project.id === selectedId ? 'project active' : 'project'}
              onClick={() => {
                setSelectedId(project.id);
                setRawText(project.sourceText);
              }}
            >
              <strong>{project.name}</strong>
              <small>{new Date(project.createdAt).toLocaleString()}</small>
            </button>
          ))}
        </div>
      </aside>

      <main>
        <header>
          <h2>{selectedProject?.name ?? 'No project selected'}</h2>
          <p>{status}</p>
        </header>

        <section className="ingest">
          <h3>Story Input</h3>
          <p>Paste plain text (short burst or chapter) or upload .txt / .rtf / .pdf / .doc / .docx.</p>
          <textarea value={rawText} onChange={(event) => setRawText(event.target.value)} rows={8} />
          <div className="row">
            <input type="file" accept=".txt,.rtf,.pdf,.doc,.docx" onChange={handleUpload} />
            <button onClick={handleIngestText} disabled={!selectedProject}>
              Ingest and create prompts
            </button>
          </div>
        </section>

        {selectedProject && (
          <>
            <section>
              <h3>Generation Mode</h3>
              <div className="row">
                <label>
                  <input
                    type="radio"
                    checked={selectedProject.imageMode === 'local'}
                    onChange={() => upsertProject({ ...selectedProject, imageMode: 'local' })}
                  />{' '}
                  Local deterministic storyboard renderer
                </label>
                <label>
                  <input
                    type="radio"
                    checked={selectedProject.imageMode === 'external'}
                    onChange={() => upsertProject({ ...selectedProject, imageMode: 'external' })}
                  />{' '}
                  External API renderer (Grok, Perplexity, custom)
                </label>
              </div>

              {selectedProject.imageMode === 'external' && (
                <div className="external-grid">
                  <select
                    value={selectedProject.externalConfig.provider}
                    onChange={(event) => updateExternalConfig('provider', event.target.value)}
                  >
                    <option value="grok">Grok</option>
                    <option value="perplexity">Perplexity</option>
                    <option value="custom">Custom</option>
                  </select>
                  <input
                    placeholder="Endpoint URL"
                    value={selectedProject.externalConfig.endpoint}
                    onChange={(event) => updateExternalConfig('endpoint', event.target.value)}
                  />
                  <input
                    placeholder="Model name"
                    value={selectedProject.externalConfig.model}
                    onChange={(event) => updateExternalConfig('model', event.target.value)}
                  />
                  <input
                    placeholder="API key"
                    type="password"
                    value={selectedProject.externalConfig.apiKey}
                    onChange={(event) => updateExternalConfig('apiKey', event.target.value)}
                  />
                </div>
              )}
            </section>

            <section>
              <h3>Consistency Asset Prompts</h3>
              <AssetEditor
                label="Characters"
                assets={selectedProject.characterAssets}
                onChange={(assets) => updateAsset('characterAssets', assets)}
              />
              <AssetEditor
                label="Environments"
                assets={selectedProject.environmentAssets}
                onChange={(assets) => updateAsset('environmentAssets', assets)}
              />
            </section>

            <section>
              <div className="row spread">
                <h3>Storyboard Scenes</h3>
                <button onClick={generateStoryboard}>Generate storyboard cards</button>
              </div>

              <div className="scene-grid">
                {selectedProject.scenes.map((scene) => (
                  <article key={scene.id}>
                    <h4>{scene.title}</h4>
                    <p className="meta">Characters: {scene.characters.join(', ') || '—'}</p>
                    <p className="meta">Environment: {scene.environments.join(', ') || '—'}</p>
                    <p>{scene.excerpt}</p>
                    <details>
                      <summary>Prompt</summary>
                      <pre>{scene.prompt}</pre>
                    </details>
                    {scene.imageDataUrl && <img src={scene.imageDataUrl} alt={scene.title} loading="lazy" />}
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function AssetEditor({
  label,
  assets,
  onChange
}: {
  label: string;
  assets: PromptAsset[];
  onChange: (assets: PromptAsset[]) => void;
}) {
  return (
    <div className="asset-block">
      <h4>{label}</h4>
      {assets.length === 0 && <p className="muted">No assets extracted yet.</p>}
      {assets.map((asset) => (
        <label key={asset.id} className="asset-row">
          <span>{asset.name}</span>
          <textarea
            rows={3}
            value={asset.prompt}
            onChange={(event) =>
              onChange(
                assets.map((item) =>
                  item.id === asset.id
                    ? {
                        ...item,
                        prompt: event.target.value
                      }
                    : item
                )
              )
            }
          />
        </label>
      ))}
    </div>
  );
}

async function requestExternalFrame(prompt: string, config: ExternalConfig): Promise<string> {
  if (!config.endpoint || !config.apiKey) {
    return createLocalFrame(`[external fallback] ${prompt}`, 'fallback');
  }

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      provider: config.provider,
      model: config.model,
      prompt,
      format: 'image_base64'
    })
  });

  if (!response.ok) {
    return createLocalFrame(`[external error ${response.status}] ${prompt}`, 'fallback');
  }

  const payload = (await response.json()) as { imageBase64?: string; imageUrl?: string };

  if (payload.imageBase64) {
    return `data:image/png;base64,${payload.imageBase64}`;
  }

  if (payload.imageUrl) {
    return payload.imageUrl;
  }

  return createLocalFrame(`[external empty response] ${prompt}`, 'fallback');
}
