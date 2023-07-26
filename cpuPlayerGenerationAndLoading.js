import {
    leaderPersonalities
} from "./leaderPersonalities.js";
import {
    mainGameArray
} from "./resourceCalculations.js";

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

    mainGameArray.forEach((territory) => {
        const countryName = territory.dataName;
        if (territory.owner !== "Player") {
            if (!countries[countryName]) {
                countries[countryName] = getRandomLeaderForCountry();
                leaders[countryName] = createLeaderObject(countries[countryName]);
            }

            territory.leader = leaders[countryName];
        } else {
            delete territory.leader;
        }

        // console.log("Leader of: " + territory.territoryName + ", " + territory.dataName + ":");
        // territory.owner === "Player" ? console.log("Player") : console.log(territory.leader);
    });
}

function createLeaderObject(leaderId) {
    const leaderTraits = {
        dominance: getRandomTraitValueForLeader("dominance", leaderId),
        economy: getRandomTraitValueForLeader("economy", leaderId),
        territory_expansion: getRandomTraitValueForLeader(
            "territory_expansion",
            leaderId
        ),
        style_of_war: getRandomTraitValueForLeader("style_of_war", leaderId),
        reconquista: getRandomTraitValueForLeader("reconquista", leaderId),
    };

    const randomGender = getRandomGender();
    const randomName = generateUniqueName(randomGender);

    return {
        name: randomName,
        leaderType: leaderId,
        traits: leaderTraits,
    };
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

    for (let i = 0; i < mainGameArray.length; i++) {
        const countryName = mainGameArray[i].dataName;

        if (!countryIndices.hasOwnProperty(countryName) && mainGameArray[i].owner !== "Player") {
            countryIndices[countryName] = arrayOfLeadersAndCountries.length;
            arrayOfLeadersAndCountries.push([countryName, mainGameArray[i].leader, [mainGameArray[i]]]);
        } else {
            if (mainGameArray[i].owner !== "Player") {
                const index = countryIndices[countryName];
                arrayOfLeadersAndCountries[index][2].push(mainGameArray[i]);
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