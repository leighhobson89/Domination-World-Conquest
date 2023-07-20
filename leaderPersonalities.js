//personalities:
//some prebuilt personalities that can be manually added to countries
//traits:
// dominance - lower numbers will not care who they attack, higher numbers will always try to conquer all territories of specific countries
// territory_expansion - lower numbers will not be too bothered about growing their empire and higher numbers will attempt to conquer many territories
// economy - lower numbers will not care too much but higher numbers will focus on building the economy of each territory they own
// style_of_war - lower numbers will favour sieges whereas higher numbers will favour pushing on even where probability is not so clear-cut of a win
// reconquista - lower numbers will not care who previously owned a territory lost territories whereas higher numbers will focus on reconquering lost territories
export const leaderPersonalities = {
	"personalities": [
		{
			"id": "aggressive",
			"dominance": {
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
			}
		},
		{
			"id": "balanced",
			"dominance": {
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
			}
		},
		{
			"id": "pacifist",
			"dominance": {
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
			}
		}
	]
}
