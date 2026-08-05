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

// AUTO-GENERATED ZONES — from Helbreath MAPDATA teleport-loc
// Traveler hub (map `default`): hand-maintained — no classic MAPDATA file for this soft zone.
export const MAP_TELEPORT_ZONES = [
    {
        "mapId": "default",
        "locs": [
            [80, 75],
            [81, 75],
            [82, 75],
            [80, 76],
            [81, 76],
            [82, 76]
        ],
        "targetMap": "aresden",
        "targetX": 149,
        "targetY": 127
    },
    {
        "mapId": "default",
        "locs": [
            [127, 78],
            [128, 78],
            [129, 78],
            [127, 79],
            [128, 79],
            [129, 79]
        ],
        "targetMap": "elvine",
        "targetX": 149,
        "targetY": 131
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
            ]
        ],
        "targetMap": "arefarm",
        "targetX": 120,
        "targetY": 25
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
        "targetMap": "elvfarm",
        "targetX": 160,
        "targetY": 227
    },
    {
        "mapId": "arefarm",
        "locs": [
            [
                20,
                22
            ],
            [
                20,
                23
            ],
            [
                20,
                24
            ],
            [
                20,
                25
            ],
            [
                20,
                26
            ],
            [
                20,
                27
            ],
            [
                20,
                28
            ],
            [
                20,
                29
            ],
            [
                20,
                30
            ]
        ],
        "targetMap": "aresden",
        "targetX": 275,
        "targetY": 205
    },
    {
        "mapId": "arefarm",
        "locs": [
            [
                114,
                23
            ],
            [
                115,
                23
            ],
            [
                116,
                23
            ],
            [
                117,
                23
            ],
            [
                118,
                23
            ],
            [
                119,
                23
            ],
            [
                120,
                23
            ],
            [
                121,
                23
            ],
            [
                122,
                23
            ],
            [
                123,
                23
            ],
            [
                124,
                23
            ],
            [
                125,
                23
            ]
        ],
        "targetMap": "2ndmiddle",
        "targetX": 140,
        "targetY": 220
    },
    {
        "mapId": "arefarm",
        "locs": [
            [
                53,
                133
            ],
            [
                54,
                133
            ],
            [
                55,
                133
            ],
            [
                55,
                132
            ]
        ],
        "targetMap": "arebrk11",
        "targetX": 28,
        "targetY": 43
    },
    {
        "mapId": "arefarm",
        "locs": [
            [
                78,
                71
            ],
            [
                79,
                69
            ],
            [
                78,
                70
            ],
            [
                80,
                69
            ],
            [
                79,
                70
            ]
        ],
        "targetMap": "middled1n",
        "targetX": 181,
        "targetY": 124
    },
    {
        "mapId": "aresden",
        "locs": [
            [
                135,
                129
            ],
            [
                136,
                129
            ],
            [
                137,
                129
            ],
            [
                137,
                128
            ],
            [
                145,
                122
            ],
            [
                144,
                123
            ],
            [
                145,
                123
            ],
            [
                146,
                123
            ],
            [
                146,
                122
            ]
        ],
        "targetMap": "cityhall_1",
        "targetX": 55,
        "targetY": 44
    },
    {
        "mapId": "aresden",
        "locs": [
            [
                185,
                93
            ],
            [
                186,
                93
            ],
            [
                186,
                92
            ],
            [
                187,
                92
            ]
        ],
        "targetMap": "cath_1",
        "targetX": 40,
        "targetY": 40
    },
    {
        "mapId": "aresden",
        "locs": [
            [
                167,
                195
            ],
            [
                168,
                195
            ],
            [
                169,
                195
            ],
            [
                169,
                194
            ]
        ],
        "targetMap": "bsmith_1",
        "targetX": 34,
        "targetY": 37
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
        "targetMap": "bsmith_1",
        "targetX": 43,
        "targetY": 32
    },
    {
        "mapId": "aresden",
        "locs": [
            [
                101,
                183
            ],
            [
                102,
                184
            ],
            [
                103,
                185
            ],
            [
                107,
                185
            ]
        ],
        "targetMap": "wrhus_1",
        "targetX": 56,
        "targetY": 36
    },
    {
        "mapId": "aresden",
        "locs": [
            [
                217,
                132
            ],
            [
                218,
                133
            ],
            [
                219,
                134
            ],
            [
                223,
                134
            ]
        ],
        "targetMap": "arewrhus",
        "targetX": 56,
        "targetY": 36
    },
    {
        "mapId": "aresden",
        "locs": [
            [
                112,
                97
            ],
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
            ]
        ],
        "targetMap": "gldhall_1",
        "targetX": 54,
        "targetY": 41
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
            ],
            [
                57,
                117
            ]
        ],
        "targetMap": "wzdtwr_1",
        "targetX": 43,
        "targetY": 34
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
            ],
            [
                130,
                167
            ],
            [
                131,
                166
            ]
        ],
        "targetMap": "gshop_1",
        "targetX": 50,
        "targetY": 39
    },
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
        "targetX": 152,
        "targetY": 500
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
        "targetX": 353,
        "targetY": 500
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
        "targetMap": "huntzone2",
        "targetX": 68,
        "targetY": 23
    },
    {
        "mapId": "aresden",
        "locs": [
            [
                78,
                210
            ],
            [
                78,
                211
            ],
            [
                79,
                209
            ],
            [
                79,
                210
            ],
            [
                80,
                209
            ]
        ],
        "targetMap": "aresdend1",
        "targetX": 96,
        "targetY": 39
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
        "targetMap": "arefarm",
        "targetX": 23,
        "targetY": 27
    },
    {
        "mapId": "aresden",
        "locs": [
            [
                94,
                161
            ],
            [
                95,
                161
            ],
            [
                95,
                160
            ]
        ],
        "targetMap": "cmdhall_1",
        "targetX": 51,
        "targetY": 50
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
        "targetMap": "cmdhall_1",
        "targetX": 40,
        "targetY": 52
    },
    {
        "mapId": "aresdend1",
        "locs": [
            [
                99,
                38
            ],
            [
                100,
                38
            ],
            [
                100,
                39
            ]
        ],
        "targetMap": "aresden",
        "targetX": 77,
        "targetY": 208
    },
    {
        "mapId": "aresdend1",
        "locs": [
            [
                97,
                85
            ],
            [
                98,
                85
            ],
            [
                99,
                85
            ],
            [
                97,
                86
            ]
        ],
        "targetMap": "huntzone2",
        "targetX": 102,
        "targetY": 105
    },
    {
        // gray-pad-117-158 (city warp, radius 1)
        "mapId": "elvfarm",
        "locs": [
            [116, 157],
            [117, 157],
            [118, 157],
            [116, 158],
            [117, 158],
            [118, 158],
            [116, 159],
            [117, 159],
            [118, 159]
        ],
        "targetMap": "elvine",
        "targetX": 158,
        "targetY": 57
    },
    {
        "mapId": "elvfarm",
        "locs": [
            [
                20,
                147
            ],
            [
                20,
                148
            ],
            [
                20,
                149
            ],
            [
                20,
                150
            ],
            [
                20,
                151
            ],
            [
                20,
                152
            ],
            [
                20,
                153
            ],
            [
                20,
                154
            ],
            [
                20,
                155
            ]
        ],
        "targetMap": "elvine",
        "targetX": 274,
        "targetY": 196
    },
    {
        "mapId": "elvfarm",
        "locs": [
            [
                156,
                229
            ],
            [
                157,
                229
            ],
            [
                158,
                229
            ],
            [
                159,
                229
            ],
            [
                160,
                229
            ],
            [
                161,
                229
            ],
            [
                162,
                229
            ],
            [
                163,
                229
            ],
            [
                164,
                229
            ]
        ],
        "targetMap": "2ndmiddle",
        "targetX": 126,
        "targetY": 28
    },
    {
        "mapId": "elvfarm",
        "locs": [
            [
                138,
                206
            ],
            [
                138,
                207
            ],
            [
                139,
                206
            ],
            [
                139,
                205
            ],
            [
                140,
                205
            ]
        ],
        "targetMap": "middled1n",
        "targetX": 33,
        "targetY": 36
    },
    {
        "mapId": "elvine",
        "locs": [
            [
                135,
                133
            ],
            [
                136,
                133
            ],
            [
                137,
                133
            ],
            [
                137,
                132
            ],
            [
                144,
                127
            ],
            [
                145,
                127
            ],
            [
                145,
                126
            ],
            [
                146,
                126
            ]
        ],
        "targetMap": "cityhall_1",
        "targetX": 57,
        "targetY": 43
    },
    {
        "mapId": "elvine",
        "locs": [
            [
                131,
                77
            ],
            [
                132,
                77
            ],
            [
                132,
                76
            ],
            [
                133,
                76
            ]
        ],
        "targetMap": "cath_1",
        "targetX": 40,
        "targetY": 40
    },
    {
        "mapId": "elvine",
        "locs": [
            [
                239,
                107
            ],
            [
                240,
                107
            ],
            [
                241,
                107
            ],
            [
                241,
                106
            ]
        ],
        "targetMap": "bsmith_1",
        "targetX": 34,
        "targetY": 37
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
        "targetMap": "bsmith_1",
        "targetX": 43,
        "targetY": 32
    },
    {
        "mapId": "elvine",
        "locs": [
            [
                197,
                127
            ],
            [
                198,
                128
            ],
            [
                199,
                129
            ],
            [
                203,
                129
            ]
        ],
        "targetMap": "wrhus_1",
        "targetX": 56,
        "targetY": 36
    },
    {
        "mapId": "elvine",
        "locs": [
            [
                87,
                174
            ],
            [
                88,
                175
            ],
            [
                89,
                176
            ],
            [
                93,
                176
            ]
        ],
        "targetMap": "elvwrhus",
        "targetX": 56,
        "targetY": 36
    },
    {
        "mapId": "elvine",
        "locs": [
            [
                76,
                141
            ],
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
            ]
        ],
        "targetMap": "gldhall_1",
        "targetX": 54,
        "targetY": 41
    },
    {
        "mapId": "elvine",
        "locs": [
            [
                180,
                77
            ],
            [
                181,
                77
            ],
            [
                181,
                76
            ]
        ],
        "targetMap": "wzdtwr_1",
        "targetX": 43,
        "targetY": 34
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
            ],
            [
                229,
                152
            ],
            [
                230,
                151
            ]
        ],
        "targetMap": "gshop_1",
        "targetX": 50,
        "targetY": 39
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
        "targetX": 103,
        "targetY": 23
    },
    {
        "mapId": "elvine",
        "locs": [
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
        "targetX": 314,
        "targetY": 23
    },
    {
        "mapId": "elvine",
        "locs": [
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
            ]
        ],
        "targetMap": "huntzone1",
        "targetX": 53,
        "targetY": 174
    },
    {
        "mapId": "elvine",
        "locs": [
            [
                258,
                82
            ],
            [
                258,
                83
            ],
            [
                259,
                82
            ],
            [
                259,
                81
            ],
            [
                260,
                81
            ]
        ],
        "targetMap": "elvined1",
        "targetX": 105,
        "targetY": 159
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
        "targetMap": "elvfarm",
        "targetX": 22,
        "targetY": 148
    },
    {
        "mapId": "elvine",
        "locs": [
            [
                213,
                89
            ],
            [
                214,
                89
            ],
            [
                214,
                88
            ]
        ],
        "targetMap": "cmdhall_1",
        "targetX": 51,
        "targetY": 50
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
        "targetX": 40,
        "targetY": 52
    },
    {
        "mapId": "elvined1",
        "locs": [
            [
                103,
                157
            ],
            [
                104,
                157
            ],
            [
                105,
                157
            ],
            [
                103,
                158
            ]
        ],
        "targetMap": "elvine",
        "targetX": 257,
        "targetY": 80
    },
    {
        "mapId": "elvined1",
        "locs": [
            [
                85,
                93
            ],
            [
                86,
                93
            ],
            [
                87,
                93
            ],
            [
                85,
                94
            ]
        ],
        "targetMap": "huntzone1",
        "targetX": 114,
        "targetY": 113
    },
    {
        "mapId": "huntzone1",
        "locs": [
            [
                44,
                179
            ],
            [
                45,
                179
            ],
            [
                46,
                179
            ],
            [
                47,
                179
            ],
            [
                48,
                179
            ],
            [
                49,
                179
            ],
            [
                50,
                179
            ],
            [
                51,
                179
            ],
            [
                52,
                179
            ],
            [
                53,
                179
            ],
            [
                54,
                179
            ],
            [
                55,
                179
            ],
            [
                56,
                179
            ],
            [
                57,
                179
            ],
            [
                58,
                179
            ]
        ],
        "targetMap": "elvine",
        "targetX": 223,
        "targetY": 23
    },
    {
        "mapId": "huntzone1",
        "locs": [
            [
                115,
                115
            ],
            [
                116,
                115
            ],
            [
                116,
                114
            ]
        ],
        "targetMap": "elvined1",
        "targetX": 87,
        "targetY": 94
    },
    {
        "mapId": "huntzone1",
        "locs": [
            [
                171,
                20
            ],
            [
                172,
                20
            ],
            [
                173,
                20
            ],
            [
                174,
                20
            ],
            [
                175,
                20
            ],
            [
                176,
                20
            ]
        ],
        "targetMap": "huntzone3",
        "targetX": 50,
        "targetY": 166
    },
    {
        "mapId": "huntzone1",
        "locs": [
            [
                20,
                48
            ],
            [
                20,
                49
            ],
            [
                20,
                50
            ],
            [
                20,
                51
            ],
            [
                20,
                52
            ],
            [
                20,
                53
            ],
            [
                20,
                54
            ],
            [
                20,
                55
            ],
            [
                20,
                56
            ]
        ],
        "targetMap": "elvuni",
        "targetX": 173,
        "targetY": 24
    },
    {
        "mapId": "huntzone2",
        "locs": [
            [
                66,
                20
            ],
            [
                67,
                20
            ],
            [
                68,
                20
            ],
            [
                69,
                20
            ],
            [
                70,
                20
            ],
            [
                71,
                20
            ],
            [
                72,
                20
            ],
            [
                73,
                20
            ],
            [
                74,
                20
            ]
        ],
        "targetMap": "aresden",
        "targetX": 32,
        "targetY": 274
    },
    {
        "mapId": "huntzone2",
        "locs": [
            [
                103,
                107
            ],
            [
                104,
                107
            ],
            [
                104,
                106
            ]
        ],
        "targetMap": "aresdend1",
        "targetX": 97,
        "targetY": 87
    },
    {
        "mapId": "huntzone2",
        "locs": [
            [
                179,
                100
            ],
            [
                179,
                101
            ],
            [
                179,
                102
            ],
            [
                179,
                103
            ],
            [
                179,
                104
            ]
        ],
        "targetMap": "huntzone4",
        "targetX": 23,
        "targetY": 93
    },
    {
        "mapId": "huntzone2",
        "locs": [
            [
                109,
                179
            ],
            [
                110,
                179
            ],
            [
                111,
                179
            ],
            [
                112,
                179
            ],
            [
                113,
                179
            ],
            [
                114,
                179
            ],
            [
                115,
                179
            ],
            [
                116,
                179
            ],
            [
                117,
                179
            ],
            [
                118,
                179
            ],
            [
                119,
                179
            ],
            [
                120,
                179
            ],
            [
                121,
                179
            ],
            [
                122,
                179
            ]
        ],
        "targetMap": "areuni",
        "targetX": 85,
        "targetY": 23
    },
    {
        "mapId": "icebound",
        "locs": [
            [
                260,
                264
            ],
            [
                261,
                264
            ],
            [
                262,
                264
            ],
            [
                263,
                264
            ],
            [
                264,
                264
            ],
            [
                265,
                264
            ],
            [
                266,
                264
            ],
            [
                267,
                264
            ],
            [
                268,
                264
            ],
            [
                269,
                264
            ]
        ],
        "targetMap": "middleland",
        "targetX": 455,
        "targetY": 279
    },
    {
        "mapId": "middled1x",
        "locs": [
            [
                67,
                106
            ],
            [
                68,
                106
            ],
            [
                68,
                105
            ],
            [
                69,
                105
            ]
        ],
        "targetMap": "middleland",
        "targetX": 198,
        "targetY": 233
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
        "targetX": 31,
        "targetY": 28
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
        "targetX": 259,
        "targetY": 23
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
        "targetMap": "elvine",
        "targetX": 27,
        "targetY": 271
    },
    {
        "mapId": "middleland",
        "locs": [
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
            ]
        ],
        "targetMap": "elvine",
        "targetX": 254,
        "targetY": 267
    },
    {
        "mapId": "middleland",
        "locs": [
            [
                199,
                235
            ],
            [
                200,
                235
            ],
            [
                200,
                234
            ]
        ],
        "targetMap": "middled1x",
        "targetX": 70,
        "targetY": 108
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
        "targetMap": "toh1",
        "targetX": 145,
        "targetY": 31
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
        "targetMap": "icebound",
        "targetX": 264,
        "targetY": 260
    },
    {
        "mapId": "toh1",
        "locs": [
            [
                146,
                29
            ],
            [
                147,
                29
            ],
            [
                147,
                30
            ]
        ],
        "targetMap": "middleland",
        "targetX": 382,
        "targetY": 286
    },
    {
        "mapId": "toh1",
        "locs": [
            [
                37,
                218
            ],
            [
                37,
                219
            ],
            [
                38,
                219
            ]
        ],
        "targetMap": "toh2",
        "targetX": 39,
        "targetY": 38
    },
    {
        "mapId": "toh1",
        "locs": [
            [
                218,
                213
            ],
            [
                219,
                213
            ],
            [
                219,
                214
            ]
        ],
        "targetMap": "toh2",
        "targetX": 272,
        "targetY": 28
    },
    {
        "mapId": "arewrhus",
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
                35
            ],
            [
                61,
                36
            ]
        ],
        "targetMap": "aresden",
        "targetX": 222,
        "targetY": 136
    },
    {
        "mapId": "elvwrhus",
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
                35
            ],
            [
                61,
                36
            ]
        ],
        "targetMap": "elvine",
        "targetX": 92,
        "targetY": 177
    }
,

/* FARM_BARRACKS_START */
    {
        "mapId": "arefarm",
        "locs": [[53,133],[54,133],[55,133],[55,132]],
        "targetMap": "arebrk11",
        "targetX": 28,
        "targetY": 43
    },
    {
        "mapId": "arebrk11",
        "locs": [[26,41],[27,41],[26,42]],
        "targetMap": "arefarm",
        "targetX": 54,
        "targetY": 133
    },
    {
        "mapId": "arebrk11",
        "locs": [[67,70],[68,70],[68,71]],
        "targetMap": "arebrk12",
        "targetX": 33,
        "targetY": 33
    },
    {
        "mapId": "arebrk12",
        "locs": [[32,33],[33,33],[32,34]],
        "targetMap": "arebrk11",
        "targetX": 67,
        "targetY": 70
    },
    {
        "mapId": "elvfarm",
        "locs": [[96,148],[97,148],[95,149],[96,149]],
        "targetMap": "elvbrk11",
        "targetX": 28,
        "targetY": 43
    },
    {
        "mapId": "elvbrk11",
        "locs": [[26,41],[27,41],[26,42]],
        "targetMap": "elvfarm",
        "targetX": 96,
        "targetY": 149
    },
    {
        "mapId": "elvbrk11",
        "locs": [[67,70],[68,70],[68,71]],
        "targetMap": "elvbrk12",
        "targetX": 33,
        "targetY": 33
    },
    {
        "mapId": "elvbrk12",
        "locs": [[32,33],[33,33],[32,34]],
        "targetMap": "elvbrk11",
        "targetX": 67,
        "targetY": 70
    },
/* FARM_BARRACKS_END */
/* FARM_BUILDING_OUTDOOR_START */

    {
        "mapId": "arefarm",
        "locs": [[59,69],[59,70],[60,70],[63,70],[64,69]],
        "targetMap": "gshop_1f",
        "targetX": 50,
        "targetY": 39
    },
    {
        "mapId": "arefarm",
        "locs": [[73,87],[74,87],[75,87],[75,86]],
        "targetMap": "bsmith_1f",
        "targetX": 34,
        "targetY": 37
    },
    {
        "mapId": "arefarm",
        "locs": [[63,92],[63,93],[64,93]],
        "targetMap": "bsmith_1f",
        "targetX": 43,
        "targetY": 32
    },
    {
        "mapId": "arefarm",
        "locs": [[34,88],[35,89],[36,90]],
        "targetMap": "wrhus_1f",
        "targetX": 59,
        "targetY": 36
    },
    {
        "mapId": "arefarm",
        "locs": [[40,90]],
        "targetMap": "wrhus_1f",
        "targetX": 56,
        "targetY": 36
    },
    {
        "mapId": "elvfarm",
        "locs": [[88,178],[88,179],[89,179],[92,179],[93,178]],
        "targetMap": "gshop_2f",
        "targetX": 50,
        "targetY": 39
    },
    {
        "mapId": "elvfarm",
        "locs": [[121,187],[122,187],[123,187],[123,186]],
        "targetMap": "bsmith_2f",
        "targetX": 34,
        "targetY": 37
    },
    {
        "mapId": "elvfarm",
        "locs": [[111,192],[111,193],[112,193]],
        "targetMap": "bsmith_2f",
        "targetX": 43,
        "targetY": 32
    },
    {
        "mapId": "elvfarm",
        "locs": [[66,195],[67,196],[68,197],[72,197]],
        "targetMap": "wrhus_2f",
        "targetX": 56,
        "targetY": 36
    },
/* FARM_BUILDING_OUTDOOR_END */
] as const;
export const INTERIOR_EXIT_ZONES = [
    {
        "mapId": "cityhall_1",
        "locs": [
            [
                60,
                43
            ],
            [
                59,
                42
            ],
            [
                58,
                42
            ],
            [
                59,
                41
            ]
        ],
        "exitsByTown": {
            "aresden": [
                "aresden",
                149,
                127
            ],
            "elvine": [
                "elvine",
                149,
                131
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
                42
            ],
            [
                60,
                41
            ]
        ],
        "exitsByTown": {
            "aresden": [
                "aresden",
                114,
                99
            ],
            "elvine": [
                "elvine",
                78,
                143
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
                129,
                169
            ],
            "elvine": [
                "elvine",
                228,
                153
            ]
        }
    },
    {
        "mapId": "bsmith_1",
        "locs": [
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
            ],
            [
                43,
                30
            ],
            [
                44,
                29
            ],
            [
                44,
                30
            ]
        ],
        "exitsByTown": {
            "aresden": [
                "aresden",
                168,
                197
            ],
            "elvine": [
                "elvine",
                241,
                109
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
            ],
            [
                61,
                36
            ]
        ],
        "exitsByTown": {
            "aresden": [
                "aresden",
                107,
                186
            ],
            "elvine": [
                "elvine",
                203,
                130
            ]
        }
    },
    {
        "mapId": "cmdhall_1",
        "locs": [
            [
                38,
                49
            ],
            [
                40,
                50
            ],
            [
                50,
                48
            ],
            [
                51,
                47
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
                49,
                48
            ],
            [
                50,
                47
            ]
        ],
        "exitsByTown": {
            "aresden": [
                "aresden",
                97,
                161
            ],
            "elvine": [
                "elvine",
                216,
                89
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
                189,
                96
            ],
            "elvine": [
                "elvine",
                135,
                80
            ]
        }
    },
    {
        "mapId": "wzdtwr_1",
        "locs": [
            [
                41,
                32
            ],
            [
                40,
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
                58,
                119
            ],
            "elvine": [
                "elvine",
                181,
                78
            ]
        }
    }
,
/* FARM_BUILDING_INTERIOR_START */

    {
        "mapId": "gshop_1f",
        "locs": [[49,36],[50,36],[49,37],[50,37],[51,37]],
        "exitsByTown": {
            "arefarm": ["arefarm", 61, 70],
            "aresden": ["arefarm", 61, 70]
        }
    },
    {
        "mapId": "bsmith_1f",
        "locs": [[33,34],[32,35],[33,35],[43,30],[44,29],[44,30]],
        "exitsByTown": {
            "arefarm": ["arefarm", 74, 88],
            "aresden": ["arefarm", 74, 88]
        }
    },
    {
        "mapId": "wrhus_1f",
        "locs": [[54,33],[53,34],[54,34],[55,34],[61,34],[61,35],[61,36]],
        "exitsByTown": {
            "arefarm": ["arefarm", 37, 90],
            "aresden": ["arefarm", 37, 90]
        }
    },
    {
        "mapId": "gshop_2f",
        "locs": [[49,36],[50,36],[49,37],[50,37],[51,37]],
        "exitsByTown": {
            "elvfarm": ["elvfarm", 90, 179],
            "elvine": ["elvfarm", 90, 179]
        }
    },
    {
        "mapId": "bsmith_2f",
        "locs": [[33,34],[32,35],[33,35],[43,30],[44,29],[44,30]],
        "exitsByTown": {
            "elvfarm": ["elvfarm", 122, 188],
            "elvine": ["elvfarm", 122, 188]
        }
    },
    {
        "mapId": "wrhus_2f",
        "locs": [[54,33],[53,34],[54,34],[55,34],[61,34],[61,35],[61,36]],
        "exitsByTown": {
            "elvfarm": ["elvfarm", 69, 197],
            "elvine": ["elvfarm", 69, 197]
        }
    },
/* FARM_BUILDING_INTERIOR_END */
] as const;
export const TOWN_MAP_IDS = ["default","aresden","elvine","middleland","2ndmiddle","arefarm","elvfarm","aresdend1","elvined1","areuni","elvuni","arebrk11","arebrk12","arebrk21","arebrk22","elvbrk11","elvbrk12","elvbrk21","elvbrk22","arejail","elvjail","middled1x","middled1n","huntzone1","huntzone2","huntzone3","huntzone4","toh1","toh2","icebound","arewrhus","elvwrhus"] as const;

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
