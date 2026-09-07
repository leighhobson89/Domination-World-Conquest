import {
    leaderPersonalities
} from "./leaderPersonalities.js";
import {
    allTerritories
} from './src/state/selectors.js';

const personalityTitlesMale = ["King", "Lord", "Emperor", "Warrior", "Champion", "Duke", "Baron", "Prince", "Sultan", "Pharaoh", "Count", "Sir", "Chief", "Captain", "Admiral", "Marquis", "Viscount", "Sir Knight", "Sheikh", "Rajah", "Khan", "Tsar", "Governor", "Sheriff", "Patriarch", "Chancellor", "Warlord", "Chiefdom", "Viceroy", "Sheikh"];
const personalityTitlesFemale = ["Queen", "Lady", "Empress", "Champion", "Duchess", "Baroness", "Princess", "Sultana", "Pharaohess", "Countess", "Dame", "Chiefess", "Empress Dowager", "Captainess", "Admiralness", "Marchioness", "Viscountess", "Dame Knight", "Sheikha", "Rani", "Khanum", "Tsarina", "Governess", "Sheriffess", "Matriarch", "Chancelless", "Warlady", "Chiefdom Woman", "Vicereine", "Sheikha"];
const nameStringsMale = ["James", "Alexander", "Arthur", "Theodore", "Gideon", "Sebastian", "Frederick", "Maximus", "Atticus", "Hector", "Oliver", "Elijah", "Benjamin", "William", "Samuel", "Michael", "Gabriel", "Matthew", "Lucas", "Nicholas", "Daniel", "Anthony", "Christopher", "Joseph", "David", "Andrew", "Ryan", "Brandon", "Jonathan", "Zachary", "Henry", "Oscar", "Finn", "Nathan", "Ezra", "Colton", "Aiden", "Mason", "Liam", "Logan", "Caleb", "Ethan", "Isaac", "Noah", "Elias", "Xavier", "Sawyer", "Hunter", "Asher", "Carter", "Avery", "Emmett", "Declan", "Jackson", "Owen", "Wyatt", "Landon", "Beckett", "Miles", "Gavin", "Connor", "Parker", "Lincoln", "Levi", "Wesley", "Silas", "Ezekiel", "Felix", "Kai", "Graham", "Julian", "Jude", "Nolan", "Cameron", "Ian", "Tristan", "Micah", "Rhys", "Kieran", "Soren", "Dylan", "Rowan", "Sawyer", "Austin", "Jordan", "Hunter", "Logan", "Carter", "Cameron", "Kyle", "Morgan", "Taylor", "Drew", "Riley", "Jordan", "Alex", "Parker", "Dakota", "Blake", "Hayden", "Jaden", "Casey", "Reese", "Rowan", "Avery", "Chen", "Wei", "Liang", "Jin", "Hao", "Yi", "Tian", "Bo", "Kang", "Liu", "Lu", "Zhao", "Huang", "Zhang", "Amin", "Khalid", "Omar", "Tariq", "Karim", "Jabari", "Idris", "Malik", "Ezekiel", "Ade", "Chidi", "Efe", "Kwame", "Sekou", "Mosi", "Jamal", "Ezio", "Dante", "Giovanni", "Antonio", "Leonardo", "Enzo", "Marco", "Angelo", "Giacomo", "Luca"];
const nameStringsFemale = ["Emma", "Olivia", "Ava", "Sophia", "Isabella", "Mia", "Amelia", "Harper", "Evelyn", "Abigail", "Emily", "Elizabeth", "Sofia", "Ella", "Avery", "Scarlett", "Grace", "Chloe", "Victoria", "Riley", "Aria", "Lily", "Aubrey", "Zoe", "Hannah", "Layla", "Nora", "Mila", "Eleanor", "Sarah", "Eliana", "Naomi", "Claire", "Stella", "Lucy", "Anna", "Isla", "Aurora", "Maya", "Leah", "Penelope", "Audrey", "Violet", "Bella", "Savannah", "Nova", "Hazel", "Aria", "Lila", "Elena", "Ariana", "Emilia", "Everly", "Luna", "Eva", "Layla", "Gianna", "Cora", "Alice", "Jasmine", "Elise", "Valentina", "Nina", "Isabel", "Zara", "Natalia", "Melanie", "Lila", "Marley", "Angelina", "Finley", "Jade", "Elaina", "Megan", "Willow", "Amy", "Lola", "Adriana", "Kira", "Fatima", "Amara", "Sara", "Amira", "Rania", "Sasha", "Ayana", "Ezra", "Eshe", "Zahra", "Nala", "Talia", "Sana", "Zuri", "Yara", "Imara", "Amina", "Zaina", "Selena", "Kalila", "Anya", "Nadia", "Maya", "Leila", "Farida", "Zoya", "Amani", "Saida", "Samara", "Ayah"];
const nameSuffixes = ["", "I", "II", "III", "IV", "the Great", "the Conqueror", "the Wise", "the Brave", "the Magnificent", "the Mighty", "the Supreme", "the Bold", "the Cunning", "the Fearless"];

let arrayOfLeadersAndCountries = [];

function getRandomNumberInRange(min, max) {
    return Math.random() * (max - min) + min;
}

function getRandomLeaderForCountry() {
    const personalities = leaderPersonalities.personalities;
    const randomIndex = Math.floor(Math.random() * personalities.length);
    return personalities[randomIndex].id;
}

function getRandomTraitValueForLeader(trait, leaderId) {
    const leaderData = leaderPersonalities.personalities.find(
        (personality) => personality.id === leaderId
    );

    const traitData = leaderData[trait];
    const min = traitData.min;
    const max = traitData.max;

    return getRandomNumberInRange(min, max);
}

export function createCpuPlayerObjectAndAddToMainArray() {
    const countries = {};
    const leaders = {};

    allTerritories().forEach((territory) => {
        const countryName = territory.dataName;
        if (territory.owner !== "Player") {
            if (!countries[countryName]) {
                countries[countryName] = getRandomLeaderForCountry();
                leaders[countryName] = createLeaderObject(countries[countryName], false);
            }
        } else {
            leaders[countryName] = createLeaderObject(countries[countryName], true);
        }
        territory.leader = leaders[countryName];
    });
}

function createLeaderObject(leaderId, player) {
    if (!player) {
        const leaderTraits = {
            fortification: getRandomTraitValueForLeader("fortification", leaderId),
            economy: getRandomTraitValueForLeader("economy", leaderId),
            territory_expansion: getRandomTraitValueForLeader(
                "territory_expansion",
                leaderId
            ),
            style_of_war: getRandomTraitValueForLeader("style_of_war", leaderId),
            reconquista: getRandomTraitValueForLeader("reconquista", leaderId),
            //How thin a border this leader will hold in order to attack. See the note in
            //`leaderPersonalities.js`: it is the trait that decides whether a country can
            //raise a force ratio worth attacking at, and every reader of it defaults to 0.5
            //so that a save taken before it existed still loads.
            risk_taking: getRandomTraitValueForLeader("risk_taking", leaderId),
        };

        const randomGender = getRandomGender();
        const randomName = generateUniqueName(randomGender);

        return {
            name: randomName,
            leaderType: leaderId,
            traits: leaderTraits
        };
    } else {
        const leaderTraits = { //player
            fortification: 0.5,
            economy: 0.5,
            territory_expansion: 0.5,
            style_of_war: 0.5,
            reconquista: 0.5,
            risk_taking: 0.5
        };

        return {
            name: "Player",
            leaderType: "human",
            traits: leaderTraits
        };
    }
}

/**
 * A country's leader dies and a new one takes over.
 *
 * The new personality is drawn from the same generator as the original, so a country that has
 * spent forty turns cautious may spend the next forty reckless -- which is the point. See
 * `src/ai/succession.js` for why this exists: a country's character was fixed for the whole
 * game, and a stalemate between two comparable neighbours is symmetric, so nothing could ever
 * break one.
 *
 * It writes the leader onto every territory the country holds, because that is where a leader
 * lives (`updateArrayOfLeadersAndCountries()` rebuilds its array from the territories each
 * turn). The PLAYER is never succeeded: `leaderType === "human"` is the player's own leader
 * and replacing it would hand the player a personality they did not choose.
 *
 * @param {string} countryName
 * @returns {{name: string, leaderType: string, traits: object}|null} the new leader, or null
 *          if the country holds nothing or is the player's
 */
export function replaceLeaderForCountry(countryName) {
    const held = allTerritories().filter((territory) =>
        territory.dataName === countryName && territory.owner !== "Player");
    if (held.length === 0) {
        return null;
    }
    if (held[0].leader?.leaderType === "human") {
        return null;
    }

    const successor = createLeaderObject(getRandomLeaderForCountry(), false);
    for (const territory of held) {
        territory.leader = successor;
    }
    return successor;
}

function getRandomElementFromArray(array) {
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
}

function generateUniqueName(gender) {
    const isMale = gender === "male";
    const title = isMale ?
        getRandomElementFromArray(personalityTitlesMale) :
        getRandomElementFromArray(personalityTitlesFemale);

    const name = isMale ?
        getRandomElementFromArray(nameStringsMale) :
        getRandomElementFromArray(nameStringsFemale);

    const suffix = getRandomElementFromArray(nameSuffixes);

    return `${title} ${name} ${suffix}`;
}

function getRandomGender() {
    const genders = ["male", "female"];
    const randomIndex = Math.floor(Math.random() * genders.length);
    return genders[randomIndex];
}

export function updateArrayOfLeadersAndCountries() { //when called sets the arrayOfLeadersAndCountries with [countryName, leaderObject, [<list of territory names>]
    const countryIndices = {};
    arrayOfLeadersAndCountries.length = 0;
    for (let i = 0; i < allTerritories().length; i++) {
        const countryName = allTerritories()[i].dataName;

        if (!countryIndices.hasOwnProperty(countryName) && allTerritories()[i].owner !== "Player") {
            countryIndices[countryName] = arrayOfLeadersAndCountries.length;
            arrayOfLeadersAndCountries.push([countryName, allTerritories()[i].leader, [allTerritories()[i]]]);
        } else {
            if (allTerritories()[i].owner !== "Player") {
                const index = countryIndices[countryName];
                arrayOfLeadersAndCountries[index][2].push(allTerritories()[i]);
            }
        }
    }

    const uniqueArray = arrayOfLeadersAndCountries.reduce((acc, curr) => {
        if (!acc.some((item) => item[0] === curr[0])) {
            acc.push(curr);
        }
        return acc;
    }, []);

    arrayOfLeadersAndCountries.length = 0;
    arrayOfLeadersAndCountries.push(...uniqueArray);
}

export function getArrayOfLeadersAndCountries() {
    return arrayOfLeadersAndCountries;
}