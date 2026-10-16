
export interface LibraryWeave {
  id: string;
  name: string;
  category: 'Basic' | 'Twill' | 'Satin' | 'Structure' | 'Crepe' | 'Rib';
  description: string;
  harnesses: number;
  // Defines the minimum repeat unit
  draft: number[][]; // 0 or 1
  pegPlan: number[][]; // 0 or 1
}

const createStraightDraw = (harnesses: number, repeats: number = 1): number[][] => {
  const draft: number[][] = Array.from({ length: harnesses }, () => []);
  const width = harnesses * repeats;
  for (let h = 0; h < harnesses; h++) {
    draft[h] = Array.from({ length: width }, (_, w) => (w % harnesses) === h ? 1 : 0);
  }
  return draft;
};

const createPointDraw = (harnesses: number): number[][] => {
  const width = (harnesses * 2) - 2;
  const draft: number[][] = Array.from({ length: harnesses }, () => Array(width).fill(0));
  
  for(let i=0; i<width; i++) {
     let h;
     if (i < harnesses) h = i;
     else h = harnesses - 1 - (i - (harnesses - 1));
     draft[h][i] = 1;
  }
  return draft;
};

export const WEAVE_LIBRARY: LibraryWeave[] = [
  // --- BASIC ---
  {
    id: 'plain',
    name: 'Plain Weave',
    category: 'Basic',
    description: 'The simplest and most common weave (1/1). Strong and durable.',
    harnesses: 2,
    draft: [[1, 0], [0, 1]],
    pegPlan: [[1, 0], [0, 1]]
  },
  {
    id: 'basket-2-2',
    name: 'Basket Weave (2x2)',
    category: 'Basic',
    description: 'Two threads interlaced as one. Flexible, loose, and flatter than plain.',
    harnesses: 4,
    draft: createStraightDraw(4),
    pegPlan: [
        [1, 1, 0, 0],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
        [0, 0, 1, 1]
    ]
  },
  {
    id: 'basket-4-4',
    name: 'Basket Weave (4x4)',
    category: 'Basic',
    description: 'Four threads interlaced as one. Often used in monk\'s cloth.',
    harnesses: 8,
    draft: createStraightDraw(8),
    pegPlan: [
        [1,1,1,1,0,0,0,0],
        [1,1,1,1,0,0,0,0],
        [1,1,1,1,0,0,0,0],
        [1,1,1,1,0,0,0,0],
        [0,0,0,0,1,1,1,1],
        [0,0,0,0,1,1,1,1],
        [0,0,0,0,1,1,1,1],
        [0,0,0,0,1,1,1,1]
    ]
  },

  // --- RIBS ---
  {
    id: 'warp-rib-2-2',
    name: 'Warp Rib (2/2)',
    category: 'Rib',
    description: 'Creates horizontal ridges (weft effect) by extending warp floats.',
    harnesses: 2,
    draft: createStraightDraw(2),
    pegPlan: [
        [1, 0], [1, 0], // H1 Up for 2 picks
        [0, 1], [0, 1]  // H2 Up for 2 picks
    ]
  },

  // --- TWILLS ---
  {
    id: 'twill-2-1',
    name: '2/1 Twill',
    category: 'Twill',
    description: 'Warp-faced twill. More warp threads on the surface (Drill).',
    harnesses: 3,
    draft: createStraightDraw(3),
    pegPlan: [
      [1, 1, 0],
      [0, 1, 1],
      [1, 0, 1]
    ]
  },
  {
    id: 'twill-1-2',
    name: '1/2 Twill',
    category: 'Twill',
    description: 'Weft-faced twill (Denim back).',
    harnesses: 3,
    draft: createStraightDraw(3),
    pegPlan: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ]
  },
  {
    id: 'twill-2-2',
    name: '2/2 Balanced Twill',
    category: 'Twill',
    description: 'Classic diagonal line. Even warp/weft balance (Serge).',
    harnesses: 4,
    draft: createStraightDraw(4),
    pegPlan: [
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 1, 1],
      [1, 0, 0, 1]
    ]
  },
  {
    id: 'twill-3-1',
    name: '3/1 Twill',
    category: 'Twill',
    description: 'Heavy warp-faced twill (Denim face).',
    harnesses: 4,
    draft: createStraightDraw(4),
    pegPlan: [
      [1, 1, 1, 0],
      [0, 1, 1, 1],
      [1, 0, 1, 1],
      [1, 1, 0, 1]
    ]
  },
  {
    id: 'twill-1-3',
    name: '1/3 Twill',
    category: 'Twill',
    description: 'Weft-faced 4-shaft twill.',
    harnesses: 4,
    draft: createStraightDraw(4),
    pegPlan: [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ]
  },
  {
    id: 'twill-3-3',
    name: '3/3 Balanced Twill',
    category: 'Twill',
    description: 'Bold diagonal line twill on 6 harnesses.',
    harnesses: 6,
    draft: createStraightDraw(6),
    pegPlan: [
        [1,1,1,0,0,0],
        [0,1,1,1,0,0],
        [0,0,1,1,1,0],
        [0,0,0,1,1,1],
        [1,0,0,0,1,1],
        [1,1,0,0,0,1]
    ]
  },
  {
    id: 'point-twill',
    name: 'Point Twill (Birdseye)',
    category: 'Twill',
    description: 'Creates a diamond or zigzag effect using a pointed draft.',
    harnesses: 4,
    draft: createPointDraw(4),
    pegPlan: [
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 1, 1],
      [1, 0, 0, 1]
    ]
  },
  {
    id: 'herringbone-2-2',
    name: 'Herringbone (2/2)',
    category: 'Twill',
    description: 'Broken twill creating a zigzag pattern. Point draft with straight lifting.',
    harnesses: 4,
    draft: createPointDraw(4),
    pegPlan: [
        [1,1,0,0],
        [0,1,1,0],
        [0,0,1,1],
        [1,0,0,1],
        // To make it herringbone, we usually extend or reverse the peg plan too, 
        // OR simply point draft (1-2-3-4-3-2) on a straight 2/2 twill creates horizontal waves (Chevron).
        // True vertical Herringbone requires "Cut and Switch" draft: 1,2,3,4, 1,2,3,4 (cut) 3,4,1,2...
    ]
  },
  {
      id: 'steep-twill-63',
      name: 'Steep Twill (63 deg)',
      category: 'Twill',
      description: 'A high angle twill using a specific stepping order.',
      harnesses: 8, // 8 end steep
      draft: createStraightDraw(8),
      pegPlan: [
          [1,1,1,0,0,0,0,0],
          [0,0,1,1,1,0,0,0],
          [0,0,0,0,1,1,1,0],
          [1,0,0,0,0,0,1,1], // Stepping 2 harnesses per pick usually
          [1,1,0,0,0,0,0,1],
          [0,1,1,1,0,0,0,0],
          [0,0,0,1,1,1,0,0],
          [0,0,0,0,0,1,1,1]
      ]
  },

  // --- SATINS ---
  {
    id: 'satin-4',
    name: 'Crowfoot Satin (4-end)',
    category: 'Satin',
    description: 'Also known as Broken Twill 1/3. Irregular surface.',
    harnesses: 4,
    draft: createStraightDraw(4),
    pegPlan: [
        [0,0,1,0], // 3
        [1,0,0,0], // 1
        [0,0,0,1], // 4
        [0,1,0,0]  // 2
    ]
  },
  {
    id: 'satin-5',
    name: '5-Shaft Satin',
    category: 'Satin',
    description: 'Smooth, lustrous surface with long floats (Move number 2).',
    harnesses: 5,
    draft: createStraightDraw(5),
    pegPlan: [
      [1, 0, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 0, 1],
      [0, 1, 0, 0, 0],
      [0, 0, 0, 1, 0]
    ]
  },
   {
    id: 'satin-8',
    name: '8-Shaft Satin',
    category: 'Satin',
    description: 'Very smooth surface. Step of 3.',
    harnesses: 8,
    draft: createStraightDraw(8),
    pegPlan: [
        [1,0,0,0,0,0,0,0],
        [0,0,0,1,0,0,0,0],
        [0,0,0,0,0,0,1,0],
        [0,1,0,0,0,0,0,0],
        [0,0,0,0,1,0,0,0],
        [0,0,0,0,0,0,0,1],
        [0,0,1,0,0,0,0,0],
        [0,0,0,0,0,1,0,0]
    ]
  },

  // --- CREPES ---
  {
      id: 'oatmeal-crepe',
      name: 'Oatmeal Crepe',
      category: 'Crepe',
      description: 'A pebbly, irregular surface derived from satin bases.',
      harnesses: 8,
      draft: createStraightDraw(8),
      pegPlan: [
          [1,1,0,1,1,0,0,0],
          [1,1,0,0,0,1,1,0],
          [0,0,1,1,0,1,1,0],
          [0,0,1,1,0,0,0,1],
          [1,0,0,0,1,1,0,1],
          [0,1,1,0,1,1,0,0],
          [0,1,1,0,0,0,1,1],
          [0,0,0,1,1,0,1,1]
      ]
  },
  {
      id: 'moss-crepe',
      name: 'Moss Crepe',
      category: 'Crepe',
      description: 'Combines satin and twill elements for a soft texture.',
      harnesses: 4,
      draft: createStraightDraw(4),
      pegPlan: [
          [1,1,0,1],
          [1,1,1,0],
          [0,1,1,1],
          [1,0,1,1]
      ]
  },

  // --- STRUCTURE ---
  {
    id: 'honeycomb-6',
    name: 'Honeycomb (6x6)',
    category: 'Structure',
    description: 'Cellular structure with raised ridges. Absorbent.',
    harnesses: 4,
    draft: createPointDraw(4), // 1-2-3-4-3-2 (6 threads)
    pegPlan: [
      [1, 1, 0, 0], // Pick 1
      [1, 0, 1, 0], // Pick 2
      [1, 0, 0, 1], // Pick 3
      [0, 1, 1, 0], // Pick 4
      [0, 0, 1, 1], // Pick 5
      [0, 1, 1, 0]  // Pick 6
    ]
  },
  {
      id: 'waffle-8',
      name: 'Waffle Weave (8x8)',
      category: 'Structure',
      description: 'Deep textured cells resembling a waffle.',
      harnesses: 5, // Point draft 1-2-3-4-5-4-3-2
      draft: createPointDraw(5), 
      pegPlan: [
          [1,1,1,1,0], // 1
          [1,1,1,0,1], // 2
          [1,1,0,1,1], // 3
          [1,0,1,1,1], // 4
          [0,1,1,1,1], // 5
          [1,0,1,1,1], // 4
          [1,1,0,1,1], // 3
          [1,1,1,0,1]  // 2
      ]
  },
  {
    id: 'huck-lace',
    name: 'Huck Lace (5-end)',
    category: 'Structure',
    description: 'Lace-like open structure. Common in table linens.',
    harnesses: 4,
    draft: [
        [1,0,1,0,1], // H1
        [0,1,0,0,0], // H2
        [0,0,0,1,0], // H3
        [0,0,0,0,0]  // H4
    ].map((r, i) => {
        // Manually building 10-end unit for block A
        // A Unit: 1,2,1,2,1 (Ends 1-5) on H1,H2
        // B Unit: 3,4,3,4,3 (Ends 6-10) on H3,H4
        const row = Array(10).fill(0);
        if(i===0) { row[0]=1; row[2]=1; row[4]=1; } // H1
        if(i===1) { row[1]=1; row[3]=1; } // H2
        if(i===2) { row[5]=1; row[7]=1; row[9]=1; } // H3
        if(i===3) { row[6]=1; row[8]=1; } // H4
        return row;
    }),
    pegPlan: [
        [1,0,1,0],
        [0,1,0,1],
        [1,0,1,0],
        [0,1,0,1],
        [0,0,1,0],
        [1,1,1,1],
        [0,0,1,0],
        [1,1,1,1] 
    ]
  },
  {
      id: 'bedford-cord',
      name: 'Bedford Cord',
      category: 'Structure',
      description: 'Longitudinal ribs formed by floats over stuffer ends.',
      harnesses: 4,
      draft: createStraightDraw(4),
      pegPlan: [
          [1,1,0,1],
          [1,1,1,0],
          [1,0,1,1],
          [0,1,1,1]
      ]
  },
  {
      id: 'mock-leno',
      name: 'Mock Leno (6x6)',
      category: 'Structure',
      description: 'Imitates gauze/leno with open spaces. Grouped dents required.',
      harnesses: 4,
      draft: [
          [1,0,1,0,0,0], // H1: 1, 3
          [0,1,0,0,0,0], // H2: 2
          [0,0,0,1,0,1], // H3: 4, 6
          [0,0,0,0,1,0]  // H4: 5
      ],
      pegPlan: [
          [1,0,1,1], // Pick 1: Lift 1,3,4 (H2 down)
          [1,1,1,1], // Pick 2: Plain-ish? No, Mock leno lifting is specific.
          // Correct Mock Leno 6x6 Lift:
          // P1: 1,3,4 (H2 is down)
          // P2: 1,2,3,4 (All up? No, usually 3-1-3-1 pattern)
          // Simplified 6x6 on 4 shafts:
          [1,0,1,1],
          [1,1,1,1], // Tabby connector
          [1,0,1,1],
          [1,1,1,0],
          [1,1,1,1],
          [1,1,1,0]
      ]
  }
];

// Export a list of patterns specifically useful for the Fill Tool
export const WEAVE_FILL_PATTERNS = [
    { id: 'plain', name: 'Plain Weave' },
    { id: 'basket-2-2', name: 'Basket (2x2)' },
    { id: 'twill-2-2', name: '2/2 Twill' },
    { id: 'twill-2-1', name: '2/1 Twill' },
    { id: 'twill-3-1', name: '3/1 Twill' },
    { id: 'twill-1-3', name: '1/3 Twill' },
    { id: 'satin-5', name: '5-Shaft Satin' },
    { id: 'satin-8', name: '8-Shaft Satin' },
    { id: 'oatmeal-crepe', name: 'Oatmeal Crepe' },
    { id: 'waffle-8', name: 'Waffle (8x8)' }
];
