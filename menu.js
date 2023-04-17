let gameInProgress = false;
let menuState = true;
const svg = document.getElementById('svg-map');

document.addEventListener("DOMContentLoaded", function() {
  // create the menu container
  const menuContainer = document.createElement("div");
  menuContainer.classList.add("menu-container");

  // create the menu options
  const title = document.createElement("td");
  title.innerText = "Domination:\nWorld Conquest";
  title.classList.add("menu-option");
  title.classList.add("title");

  const option3 = document.createElement("button");
  option3.innerText = "New Game";
  option3.classList.add("menu-option");
  option3.classList.add("option-3");

  const option4 = document.createElement("button");
  option4.innerText = "Option 4";
  option4.classList.add("menu-option");
  option4.classList.add("option-4");

  const option5 = document.createElement("button");
  option5.innerText = "Option 5";
  option5.classList.add("menu-option");
  option5.classList.add("option-5");

  // add event listener to New Game button
  option3.addEventListener("click", function() {
    toggleTableContainer(true);
    blurEffect(1);
    document.getElementById("menu-container").style.display = "none";
    gameInProgress = true;
    menuState = false;
  });

  // add the menu options to the menu container
  menuContainer.appendChild(title);
  menuContainer.appendChild(option3);
  menuContainer.appendChild(option4);
  menuContainer.appendChild(option5);

  // add the menu container to the HTML body
  document.getElementById("menu-container").appendChild(menuContainer);
});

function toggleTableContainer(turnOnTable) {
  var tableContainer = document.getElementById("table-container");
  if (turnOnTable) {
    tableContainer.style.display = "block";
  } else if (!turnOnTable) {
    tableContainer.style.display = "none";
  }
}

window.addEventListener("keydown", function(event) {
  if (event.code === "Escape" && gameInProgress && !menuState) {
    blurEffect(0);
    document.getElementById("menu-container").style.display = "block";
    toggleTableContainer(false);
    menuState = true;
  } else if (event.code === "Escape" && gameInProgress && menuState) {
    blurEffect(1);
    selectCountry(prevPath, true);
    toggleTableContainer(true);
    document.getElementById("menu-container").style.display = "none";
    menuState = false;
  }
});

