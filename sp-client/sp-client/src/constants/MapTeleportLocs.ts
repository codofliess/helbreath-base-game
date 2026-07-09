export interface MapTeleportDestination {
    targetMap: string;
    targetX: number;
    targetY: number;
}

type InteriorExitZone = {
    mapId: string;
    locs: readonly (readonly [number, number])[];
    exitsByTown: Record<string, readonly [string, number, number]>;
};

export const MAP_TELEPORT_ZONES = [
  {
    "mapId": "aresden",
    "locs": [
      [
        27,
        20
      ],
      [
        28,
        20
      ],
      [
        29,
        20
      ],
      [
        30,
        20
      ],
      [
        31,
        20
      ],
      [
        32,
        20
      ],
      [
        33,
        20
      ],
      [
        34,
        20
      ],
      [
        35,
        20
      ]
    ],
    "targetMap": "middleland",
    "targetX": 314,
    "targetY": 21
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        258,
        20
      ],
      [
        259,
        20
      ],
      [
        260,
        20
      ],
      [
        261,
        20
      ],
      [
        262,
        20
      ],
      [
        263,
        20
      ],
      [
        264,
        20
      ],
      [
        265,
        20
      ],
      [
        266,
        20
      ]
    ],
    "targetMap": "middleland",
    "targetX": 102,
    "targetY": 21
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        186,
        92
      ],
      [
        187,
        92
      ],
      [
        186,
        93
      ],
      [
        185,
        93
      ]
    ],
    "targetMap": "cath_1",
    "targetX": 38,
    "targetY": 40
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        113,
        96
      ],
      [
        113,
        97
      ],
      [
        114,
        97
      ],
      [
        112,
        97
      ]
    ],
    "targetMap": "gshop_1",
    "targetX": 49,
    "targetY": 38
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        57,
        117
      ]
    ],
    "targetMap": "gldhall_1",
    "targetX": 59,
    "targetY": 42
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        55,
        118
      ],
      [
        56,
        118
      ]
    ],
    "targetMap": "gldhall_1",
    "targetX": 59,
    "targetY": 42
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        145,
        122
      ],
      [
        146,
        122
      ],
      [
        145,
        123
      ],
      [
        144,
        123
      ]
    ],
    "targetMap": "2ndmiddle",
    "targetX": 141,
    "targetY": 227
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        137,
        128
      ],
      [
        137,
        129
      ],
      [
        136,
        129
      ],
      [
        135,
        129
      ]
    ],
    "targetMap": "cityhall_1",
    "targetX": 59,
    "targetY": 43
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        218,
        133
      ]
    ],
    "targetMap": "aresdend1",
    "targetX": 38,
    "targetY": 34
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        223,
        134
      ]
    ],
    "targetMap": "arebrk11",
    "targetX": 104,
    "targetY": 37
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        101,
        159
      ],
      [
        102,
        159
      ],
      [
        103,
        159
      ]
    ],
    "targetMap": "bsmith_1",
    "targetX": 44,
    "targetY": 31
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        95,
        160
      ],
      [
        95,
        161
      ],
      [
        94,
        161
      ]
    ],
    "targetMap": "bsmith_1",
    "targetX": 44,
    "targetY": 31
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        126,
        166
      ],
      [
        126,
        167
      ],
      [
        127,
        167
      ]
    ],
    "targetMap": "wrhus_1",
    "targetX": 54,
    "targetY": 35
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        131,
        166
      ]
    ],
    "targetMap": "wrhus_1",
    "targetX": 54,
    "targetY": 35
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        130,
        167
      ]
    ],
    "targetMap": "wrhus_1",
    "targetX": 54,
    "targetY": 35
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        102,
        184
      ]
    ],
    "targetMap": "arefarm",
    "targetX": 61,
    "targetY": 70
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        107,
        185
      ]
    ],
    "targetMap": "arefarm",
    "targetX": 61,
    "targetY": 70
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        169,
        194
      ],
      [
        169,
        195
      ],
      [
        168,
        195
      ],
      [
        167,
        195
      ]
    ],
    "targetMap": "wzdtwr_1",
    "targetX": 41,
    "targetY": 33
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        157,
        200
      ],
      [
        157,
        201
      ],
      [
        158,
        201
      ]
    ],
    "targetMap": "cmdhall_1",
    "targetX": 51,
    "targetY": 48
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        279,
        203
      ],
      [
        279,
        204
      ],
      [
        279,
        205
      ],
      [
        279,
        206
      ],
      [
        279,
        207
      ],
      [
        279,
        208
      ],
      [
        279,
        209
      ],
      [
        279,
        210
      ]
    ],
    "targetMap": "middleland",
    "targetX": 349,
    "targetY": 502
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        79,
        209
      ],
      [
        80,
        209
      ],
      [
        79,
        210
      ],
      [
        78,
        210
      ],
      [
        78,
        211
      ]
    ],
    "targetMap": "middleland",
    "targetX": 381,
    "targetY": 285
  },
  {
    "mapId": "aresden",
    "locs": [
      [
        26,
        279
      ],
      [
        27,
        279
      ],
      [
        28,
        279
      ],
      [
        29,
        279
      ],
      [
        30,
        279
      ],
      [
        31,
        279
      ],
      [
        32,
        279
      ],
      [
        33,
        279
      ],
      [
        34,
        279
      ],
      [
        35,
        279
      ],
      [
        36,
        279
      ],
      [
        37,
        279
      ],
      [
        38,
        279
      ],
      [
        39,
        279
      ]
    ],
    "targetMap": "middleland",
    "targetX": 152,
    "targetY": 502
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        218,
        20
      ],
      [
        219,
        20
      ],
      [
        220,
        20
      ],
      [
        221,
        20
      ],
      [
        222,
        20
      ],
      [
        223,
        20
      ],
      [
        224,
        20
      ],
      [
        225,
        20
      ],
      [
        226,
        20
      ],
      [
        227,
        20
      ],
      [
        228,
        20
      ],
      [
        229,
        20
      ],
      [
        230,
        20
      ]
    ],
    "targetMap": "middleland",
    "targetX": 102,
    "targetY": 21
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        132,
        76
      ],
      [
        133,
        76
      ],
      [
        132,
        77
      ],
      [
        131,
        77
      ]
    ],
    "targetMap": "gshop_1",
    "targetX": 49,
    "targetY": 38
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        181,
        76
      ],
      [
        181,
        77
      ],
      [
        180,
        77
      ]
    ],
    "targetMap": "cath_1",
    "targetX": 38,
    "targetY": 40
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        259,
        81
      ],
      [
        260,
        81
      ],
      [
        259,
        82
      ],
      [
        258,
        82
      ],
      [
        258,
        83
      ]
    ],
    "targetMap": "wzdtwr_1",
    "targetX": 41,
    "targetY": 33
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        220,
        87
      ],
      [
        221,
        87
      ],
      [
        222,
        87
      ]
    ],
    "targetMap": "cmdhall_1",
    "targetX": 51,
    "targetY": 48
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        214,
        88
      ],
      [
        214,
        89
      ],
      [
        213,
        89
      ]
    ],
    "targetMap": "elvjail",
    "targetX": 43,
    "targetY": 30
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        241,
        106
      ],
      [
        241,
        107
      ],
      [
        240,
        107
      ],
      [
        239,
        107
      ]
    ],
    "targetMap": "bsmith_1",
    "targetX": 44,
    "targetY": 31
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        229,
        112
      ],
      [
        229,
        113
      ],
      [
        230,
        113
      ]
    ],
    "targetMap": "elvined1",
    "targetX": 37,
    "targetY": 33
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        145,
        126
      ],
      [
        146,
        126
      ],
      [
        145,
        127
      ],
      [
        144,
        127
      ]
    ],
    "targetMap": "2ndmiddle",
    "targetX": 141,
    "targetY": 227
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        198,
        128
      ]
    ],
    "targetMap": "elvuni",
    "targetX": 175,
    "targetY": 24
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        203,
        129
      ]
    ],
    "targetMap": "elvbrk11",
    "targetX": 104,
    "targetY": 37
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        137,
        132
      ],
      [
        137,
        133
      ],
      [
        136,
        133
      ],
      [
        135,
        133
      ]
    ],
    "targetMap": "cityhall_1",
    "targetX": 59,
    "targetY": 43
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        77,
        140
      ],
      [
        77,
        141
      ],
      [
        78,
        141
      ],
      [
        76,
        141
      ]
    ],
    "targetMap": "gldhall_1",
    "targetX": 59,
    "targetY": 42
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        225,
        151
      ],
      [
        225,
        152
      ],
      [
        226,
        152
      ]
    ],
    "targetMap": "wrhus_1",
    "targetX": 54,
    "targetY": 35
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        230,
        151
      ]
    ],
    "targetMap": "wrhus_1",
    "targetX": 54,
    "targetY": 35
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        229,
        152
      ]
    ],
    "targetMap": "wrhus_1",
    "targetX": 54,
    "targetY": 35
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        88,
        175
      ]
    ],
    "targetMap": "elvfarm",
    "targetX": 87,
    "targetY": 179
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        93,
        176
      ]
    ],
    "targetMap": "elvfarm",
    "targetX": 87,
    "targetY": 179
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        277,
        192
      ],
      [
        277,
        193
      ],
      [
        277,
        194
      ],
      [
        277,
        195
      ],
      [
        277,
        196
      ],
      [
        277,
        197
      ],
      [
        277,
        198
      ],
      [
        277,
        199
      ]
    ],
    "targetMap": "middleland",
    "targetX": 314,
    "targetY": 21
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        250,
        274
      ],
      [
        251,
        274
      ],
      [
        252,
        274
      ],
      [
        253,
        274
      ],
      [
        254,
        274
      ],
      [
        255,
        274
      ],
      [
        256,
        274
      ],
      [
        257,
        274
      ]
    ],
    "targetMap": "middleland",
    "targetX": 152,
    "targetY": 502
  },
  {
    "mapId": "elvine",
    "locs": [
      [
        21,
        277
      ],
      [
        22,
        277
      ],
      [
        23,
        277
      ],
      [
        24,
        277
      ],
      [
        25,
        277
      ],
      [
        26,
        277
      ]
    ],
    "targetMap": "middleland",
    "targetX": 349,
    "targetY": 502
  },
  {
    "mapId": "middleland",
    "locs": [
      [
        99,
        20
      ],
      [
        100,
        20
      ],
      [
        101,
        20
      ],
      [
        102,
        20
      ],
      [
        103,
        20
      ],
      [
        104,
        20
      ],
      [
        105,
        20
      ],
      [
        106,
        20
      ],
      [
        107,
        20
      ]
    ],
    "targetMap": "aresden",
    "targetX": 261,
    "targetY": 21
  },
  {
    "mapId": "middleland",
    "locs": [
      [
        309,
        20
      ],
      [
        310,
        20
      ],
      [
        311,
        20
      ],
      [
        312,
        20
      ],
      [
        313,
        20
      ],
      [
        314,
        20
      ],
      [
        315,
        20
      ],
      [
        316,
        20
      ],
      [
        317,
        20
      ],
      [
        318,
        20
      ],
      [
        319,
        20
      ],
      [
        320,
        20
      ]
    ],
    "targetMap": "aresden",
    "targetX": 30,
    "targetY": 21
  },
  {
    "mapId": "middleland",
    "locs": [
      [
        200,
        234
      ],
      [
        200,
        235
      ],
      [
        199,
        235
      ]
    ],
    "targetMap": "middled1x",
    "targetX": 100,
    "targetY": 50
  },
  {
    "mapId": "middleland",
    "locs": [
      [
        452,
        281
      ],
      [
        453,
        281
      ],
      [
        452,
        282
      ],
      [
        453,
        282
      ]
    ],
    "targetMap": "elvine",
    "targetX": 276,
    "targetY": 195
  },
  {
    "mapId": "middleland",
    "locs": [
      [
        381,
        284
      ],
      [
        382,
        284
      ],
      [
        383,
        284
      ]
    ],
    "targetMap": "aresden",
    "targetX": 78,
    "targetY": 209
  },
  {
    "mapId": "middleland",
    "locs": [
      [
        147,
        503
      ],
      [
        148,
        503
      ],
      [
        149,
        503
      ],
      [
        150,
        503
      ],
      [
        151,
        503
      ],
      [
        152,
        503
      ],
      [
        153,
        503
      ],
      [
        154,
        503
      ],
      [
        155,
        503
      ],
      [
        156,
        503
      ],
      [
        157,
        503
      ],
      [
        158,
        503
      ]
    ],
    "targetMap": "aresden",
    "targetX": 32,
    "targetY": 278
  },
  {
    "mapId": "middleland",
    "locs": [
      [
        344,
        503
      ],
      [
        345,
        503
      ],
      [
        346,
        503
      ],
      [
        347,
        503
      ],
      [
        348,
        503
      ],
      [
        349,
        503
      ],
      [
        350,
        503
      ],
      [
        351,
        503
      ],
      [
        352,
        503
      ],
      [
        353,
        503
      ],
      [
        354,
        503
      ],
      [
        355,
        503
      ],
      [
        356,
        503
      ]
    ],
    "targetMap": "aresden",
    "targetX": 278,
    "targetY": 206
  },
  {
    "mapId": "2ndmiddle",
    "locs": [
      [
        121,
        21
      ],
      [
        122,
        21
      ],
      [
        123,
        21
      ],
      [
        124,
        21
      ],
      [
        125,
        21
      ],
      [
        126,
        21
      ],
      [
        127,
        21
      ],
      [
        128,
        21
      ],
      [
        129,
        21
      ],
      [
        130,
        21
      ],
      [
        131,
        21
      ]
    ],
    "targetMap": "middleland",
    "targetX": 199,
    "targetY": 234
  },
  {
    "mapId": "2ndmiddle",
    "locs": [
      [
        135,
        228
      ],
      [
        136,
        228
      ],
      [
        137,
        228
      ],
      [
        138,
        228
      ],
      [
        139,
        228
      ],
      [
        140,
        228
      ],
      [
        141,
        228
      ],
      [
        142,
        228
      ],
      [
        143,
        228
      ],
      [
        144,
        228
      ],
      [
        145,
        228
      ],
      [
        146,
        228
      ]
    ],
    "targetMap": "aresden",
    "targetX": 146,
    "targetY": 123
  }
] as const;
export const INTERIOR_EXIT_ZONES = [
  {
    "mapId": "cityhall_1",
    "locs": [
      [
        59,
        41
      ],
      [
        58,
        42
      ],
      [
        59,
        42
      ]
    ],
    "exitsByTown": {
      "aresden": [
        "aresden",
        137,
        130
      ],
      "elvine": [
        "elvine",
        137,
        134
      ]
    }
  },
  {
    "mapId": "gldhall_1",
    "locs": [
      [
        59,
        41
      ],
      [
        60,
        41
      ],
      [
        60,
        42
      ]
    ],
    "exitsByTown": {
      "aresden": [
        "aresden",
        55,
        119
      ],
      "elvine": [
        "elvine",
        77,
        142
      ]
    }
  },
  {
    "mapId": "gshop_1",
    "locs": [
      [
        49,
        36
      ],
      [
        50,
        36
      ],
      [
        49,
        37
      ],
      [
        50,
        37
      ],
      [
        51,
        37
      ]
    ],
    "exitsByTown": {
      "aresden": [
        "aresden",
        113,
        98
      ],
      "elvine": [
        "elvine",
        133,
        77
      ]
    }
  },
  {
    "mapId": "bsmith_1",
    "locs": [
      [
        44,
        29
      ],
      [
        43,
        30
      ],
      [
        44,
        30
      ],
      [
        33,
        34
      ],
      [
        32,
        35
      ],
      [
        33,
        35
      ]
    ],
    "exitsByTown": {
      "aresden": [
        "aresden",
        101,
        160
      ],
      "elvine": [
        "elvine",
        241,
        108
      ]
    }
  },
  {
    "mapId": "wrhus_1",
    "locs": [
      [
        54,
        33
      ],
      [
        53,
        34
      ],
      [
        54,
        34
      ],
      [
        55,
        34
      ],
      [
        61,
        34
      ],
      [
        61,
        35
      ]
    ],
    "exitsByTown": {
      "aresden": [
        "aresden",
        128,
        167
      ],
      "elvine": [
        "elvine",
        224,
        151
      ]
    }
  },
  {
    "mapId": "cmdhall_1",
    "locs": [
      [
        50,
        47
      ],
      [
        51,
        47
      ],
      [
        49,
        48
      ],
      [
        50,
        48
      ],
      [
        38,
        49
      ],
      [
        39,
        49
      ],
      [
        39,
        50
      ],
      [
        40,
        50
      ]
    ],
    "exitsByTown": {
      "aresden": [
        "aresden",
        156,
        200
      ],
      "elvine": [
        "elvine",
        220,
        88
      ]
    }
  },
  {
    "mapId": "cath_1",
    "locs": [
      [
        37,
        38
      ],
      [
        37,
        39
      ],
      [
        38,
        39
      ],
      [
        36,
        40
      ],
      [
        37,
        40
      ]
    ],
    "exitsByTown": {
      "aresden": [
        "aresden",
        187,
        93
      ],
      "elvine": [
        "elvine",
        182,
        76
      ]
    }
  },
  {
    "mapId": "wzdtwr_1",
    "locs": [
      [
        40,
        32
      ],
      [
        41,
        32
      ],
      [
        40,
        33
      ]
    ],
    "exitsByTown": {
      "aresden": [
        "aresden",
        169,
        196
      ],
      "elvine": [
        "elvine",
        258,
        81
      ]
    }
  }
] as const;
export const TOWN_MAP_IDS = ["aresden","elvine","middleland","2ndmiddle","arefarm","elvfarm","aresdend1","elvined1","areuni","elvuni","arebrk11","elvbrk11","arejail","elvjail","middled1x"] as const;

const interiorExitLookup = new Map<string, InteriorExitZone>();
for (const zone of INTERIOR_EXIT_ZONES) {
    for (const [x, y] of zone.locs) {
        interiorExitLookup.set(`${zone.mapId}:${x}:${y}`, zone);
    }
}

const outdoorLookup = new Map<string, MapTeleportDestination>();
for (const zone of MAP_TELEPORT_ZONES) {
    const dest: MapTeleportDestination = {
        targetMap: zone.targetMap,
        targetX: zone.targetX,
        targetY: zone.targetY,
    };
    for (const [x, y] of zone.locs) {
        outdoorLookup.set(`${zone.mapId}:${x}:${y}`, dest);
    }
}

/** Strips registry/cache prefixes so `map-aresden`, `aresden.amd`, and `aresden` all become `aresden`. */
export function normalizeMapId(raw: string): string {
    let id = raw.trim();
    if (id.startsWith('map-')) {
        id = id.slice(4);
    }
    if (id.toLowerCase().endsWith('.amd')) {
        id = id.slice(0, -4);
    }
    return id;
}

export function isTownMapId(mapId: string): boolean {
    return (TOWN_MAP_IDS as readonly string[]).includes(normalizeMapId(mapId));
}

export function isInteriorMapId(mapId: string): boolean {
    return INTERIOR_EXIT_ZONES.some((zone) => zone.mapId === normalizeMapId(mapId));
}

export function getTeleportLookupKey(mapId: string, x: number, y: number): string {
    return `${normalizeMapId(mapId)}:${x}:${y}`;
}

/** Returns the exit/warp door tiles for a shared interior map (used to find a safe entry spawn). */
export function getInteriorDoorTiles(mapId: string): readonly (readonly [number, number])[] {
    const normalized = normalizeMapId(mapId);
    const zone = INTERIOR_EXIT_ZONES.find((entry) => entry.mapId === normalized);
    return zone?.locs ?? [];
}

/** Returns all warp tiles in the outdoor cluster containing (x, y), for safe exit spawns. */
export function getOutdoorWarpClusterTiles(mapId: string, x: number, y: number): readonly (readonly [number, number])[] {
    const normalized = normalizeMapId(mapId);
    for (const zone of MAP_TELEPORT_ZONES) {
        if (normalizeMapId(zone.mapId) !== normalized) {
            continue;
        }
        if (zone.locs.some(([lx, ly]) => lx === x && ly === y)) {
            return zone.locs;
        }
    }
    return [];
}

const knownWarpCells = new Set<string>();
for (const zone of MAP_TELEPORT_ZONES) {
    for (const [x, y] of zone.locs) {
        knownWarpCells.add(getTeleportLookupKey(zone.mapId, x, y));
    }
}
for (const zone of INTERIOR_EXIT_ZONES) {
    for (const [x, y] of zone.locs) {
        knownWarpCells.add(getTeleportLookupKey(zone.mapId, x, y));
    }
}

/** True when (x, y) is a configured warp cell (blue tile) on this map. */
export function isKnownWarpCell(mapId: string, x: number, y: number): boolean {
    return knownWarpCells.has(getTeleportLookupKey(mapId, x, y));
}

/** Returns warp door tiles for a cell — outdoor building entrance or interior exit door. */
export function getKnownWarpClusterTiles(mapId: string, x: number, y: number): readonly (readonly [number, number])[] {
    const outdoor = getOutdoorWarpClusterTiles(mapId, x, y);
    if (outdoor.length > 0) {
        return outdoor;
    }
    const normalized = normalizeMapId(mapId);
    const interior = INTERIOR_EXIT_ZONES.find((zone) => zone.mapId === normalized);
    if (interior?.locs.some(([lx, ly]) => lx === x && ly === y)) {
        return interior.locs;
    }
    return [];
}

export function resolveTeleportDestination(
    mapId: string,
    x: number,
    y: number,
    lastOutdoorMap?: string,
): MapTeleportDestination | undefined {
    const normalizedMapId = normalizeMapId(mapId);
    const key = getTeleportLookupKey(normalizedMapId, x, y);

    const outdoor = outdoorLookup.get(key);
    if (outdoor) {
        return outdoor;
    }

    const exitZone = interiorExitLookup.get(key);
    if (!exitZone) {
        return undefined;
    }

    const townKey = normalizeMapId(lastOutdoorMap ?? 'aresden');
    const exit = exitZone.exitsByTown[townKey] ?? exitZone.exitsByTown.aresden;
    if (!exit) {
        return undefined;
    }
    return { targetMap: exit[0], targetX: exit[1], targetY: exit[2] };
}
