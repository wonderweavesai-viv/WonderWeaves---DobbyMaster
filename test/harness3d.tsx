import React from 'react';
import ReactDOM from 'react-dom/client';
import '../src/styles.css';
import { Fabric3DStudio } from '../components/Fabric3DStudio';

const yarn = (color: string): any => ({ color, twist: 'Z', tpi: 15, thickness: 1, roughness: 0.4, fiberType: 'Cotton' });
const structure: boolean[][] = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + c) % 2 === 0));

(window as any).__errors = [];
window.addEventListener('error', e => (window as any).__errors.push(String(e.message)));
window.addEventListener('unhandledrejection', e => (window as any).__errors.push('rejection: ' + String((e as any).reason)));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <div style={{ width: '100%', height: '100%', display: 'flex' }}>
    <Fabric3DStudio
      weavePattern={[]} structure={structure}
      warpYarns={{ A: yarn('#1e3a8a'), B: yarn('#f59e0b') }} weftYarns={{ A: yarn('#e5e7eb'), B: yarn('#dc2626') }}
      warpYarnSequence={['A', 'B']} weftYarnSequence={['A', 'B']}
      textureUrl="data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs="
      epi={60} ppi={50}
    />
  </div>
);
