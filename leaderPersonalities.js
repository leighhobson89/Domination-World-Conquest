//personalities:
//some prebuilt personalities that can be manually added to countries
//traits:
// fortification - lower numbers will not put focus on defending, higher numbers will.
// territory_expansion - lower numbers will not be too bothered about growing their empire and higher numbers will attempt to conquer many territories
// economy - lower numbers will not care too much but higher numbers will focus on building the economy of each territory they own
// style_of_war - lower numbers will favour sieges whereas higher numbers will favour pushing on even where probability is not so clear-cut of a win
// reconquista - lower numbers will not care who previously owned a territory lost territories whereas higher numbers will focus on reconquering lost territories
// risk_taking - how thin a border this leader will hold in order to attack. LOW keeps a heavy
//               reserve against the strongest neighbour and can therefore rarely raise a
//               force ratio worth attacking at; HIGH strips the border and takes the chance.
//               It is the dial that decides whether a country can break a deadlock at all:
//               measured, a territory holding the cautious reserve attacks at 0.35:1, which
//               is a 0.0% chance of winning on flat ground with no forts.
export const leaderPersonalities = {
	"personalities": [{
		"id": "aggressive",
		"fortification": {
			"min": 0.0,
			"max": 1.0
		},
		"economy": {
			"min": 0.1,
			"max": 0.5
		},
		"territory_expansion": {
			"min": 0.8,
			"max": 1.0
		},
		"style_of_war": {
			"min": 0.7,
			"max": 1.0
		},
		"reconquista": {
			"min": 0.1,
			"max": 0.4
		},
		"risk_taking": {
			"min": 0.6,
			"max": 1.0
		}
	},
		{
			"id": "balanced",
			"fortification": {
				"min": 0.0,
				"max": 1.0
			},
			"economy": {
				"min": 0.4,
				"max": 0.6
			},
			"territory_expansion": {
				"min": 0.5,
				"max": 0.7
			},
			"style_of_war": {
				"min": 0.4,
				"max": 0.7
			},
			"reconquista": {
				"min": 0.4,
				"max": 0.6
			},
			"risk_taking": {
				"min": 0.3,
				"max": 0.7
			}
		},
		{
			"id": "pacifist",
			"fortification": {
				"min": 0.0,
				"max": 1.0
			},
			"economy": {
				"min": 0.7,
				"max": 1.0
			},
			"territory_expansion": {
				"min": 0.1,
				"max": 0.3
			},
			"style_of_war": {
				"min": 0.1,
				"max": 0.4
			},
			"reconquista": {
				"min": 0.6,
				"max": 1.0
			},
			"risk_taking": {
				"min": 0.0,
				"max": 0.4
			}
		}
	]
}