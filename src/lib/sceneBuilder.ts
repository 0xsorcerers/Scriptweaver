import { PromptAsset, Scene } from '../types';

const LOCATION_WORDS = [
  'forest',
  'city',
  'village',
  'room',
  'street',
  'castle',
  'ocean',
  'school',
  'apartment',
  'office',
  'market',
  'desert',
  'mountain',
  'station'
];

const styleSeed = [
  'cinematic lighting',
  'graphic novel color blocking',
  'expressive character posing',
  'dramatic perspective',
  'storycard composition',
  'clean line art with painterly shading'
];

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function seededPick<T>(arr: T[], seed: string): T {
  return arr[hash(seed) % arr.length];
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function findCharacters(text: string): string[] {
  const candidates = text.match(/\b[A-Z][a-z]{2,}\b/g) || [];
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    counts.set(candidate, (counts.get(candidate) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name);
}

function findEnvironments(text: string): string[] {
  const lowered = text.toLowerCase();
  return LOCATION_WORDS.filter((item) => lowered.includes(item)).slice(0, 8);
}

export function buildAssets(sourceText: string): {
  characterAssets: PromptAsset[];
  environmentAssets: PromptAsset[];
} {
  const characters = findCharacters(sourceText);
  const environments = findEnvironments(sourceText);

  const characterAssets = characters.map((name) => ({
    id: `char-${name.toLowerCase()}`,
    name,
    prompt: `${name} in a consistent visual design, ${seededPick(styleSeed, name)}, recognizable silhouette, wardrobe continuity, storyboard character turnaround style`
  }));

  const environmentAssets = environments.map((name) => ({
    id: `env-${name}`,
    name,
    prompt: `${name} environment key art, ${seededPick(styleSeed, name)}, stable architecture and prop layout, scene geography continuity`
  }));

  return { characterAssets, environmentAssets };
}

export function buildScenes(sourceText: string, characterAssets: PromptAsset[], environmentAssets: PromptAsset[]): Scene[] {
  const paragraphs = sourceText
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks = paragraphs.length > 1 ? paragraphs : sourceText.split(/(?<=[.!?])\s+/).filter(Boolean);

  return chunks.slice(0, 24).map((excerpt, index) => {
    const sceneChars = characterAssets
      .filter((asset) => excerpt.includes(asset.name))
      .slice(0, 3)
      .map((item) => item.name);

    const sceneEnvs = environmentAssets
      .filter((asset) => excerpt.toLowerCase().includes(asset.name.toLowerCase()))
      .slice(0, 2)
      .map((item) => item.name);

    const selectedChars = unique(sceneChars.length ? sceneChars : characterAssets.slice(0, 2).map((item) => item.name));
    const selectedEnvs = unique(sceneEnvs.length ? sceneEnvs : environmentAssets.slice(0, 1).map((item) => item.name));

    const charPrompt = characterAssets
      .filter((asset) => selectedChars.includes(asset.name))
      .map((asset) => asset.prompt)
      .join('; ');

    const envPrompt = environmentAssets
      .filter((asset) => selectedEnvs.includes(asset.name))
      .map((asset) => asset.prompt)
      .join('; ');

    return {
      id: `scene-${index + 1}`,
      title: `Scene ${index + 1}`,
      excerpt,
      characters: selectedChars,
      environments: selectedEnvs,
      prompt: [
        'graphic animation storyboard frame, evocative, narrative clarity',
        charPrompt,
        envPrompt,
        `Action beat: ${excerpt.slice(0, 220)}`,
        'consistent character model and environment continuity, expressive lighting, readable composition'
      ]
        .filter(Boolean)
        .join(', ')
    };
  });
}

export function createLocalFrame(prompt: string, sceneId: string): string {
  const hue = hash(prompt) % 360;
  const accent = hash(sceneId + prompt) % 360;
  const label = prompt.slice(0, 120).replace(/[<&>]/g, '');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='768' height='432'>
  <defs>
    <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='hsl(${hue},72%,26%)'/>
      <stop offset='100%' stop-color='hsl(${accent},74%,16%)'/>
    </linearGradient>
  </defs>
  <rect width='100%' height='100%' fill='url(#bg)'/>
  <rect x='24' y='24' width='720' height='384' fill='none' stroke='rgba(255,255,255,0.7)' stroke-width='2'/>
  <text x='38' y='70' fill='white' font-family='Inter, Arial' font-size='24' font-weight='700'>${sceneId.toUpperCase()} STORYCARD</text>
  <foreignObject x='38' y='90' width='690' height='300'>
    <div xmlns='http://www.w3.org/1999/xhtml' style='color:white;font-family:Inter,Arial;font-size:20px;line-height:1.35;'>${label}</div>
  </foreignObject>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
