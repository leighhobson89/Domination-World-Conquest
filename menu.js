let gameInProgress = false;
let menuState = true;

document.addEventListener("DOMContentLoaded", function() {
  // create the menu container
  const menuContainer = document.createElement("div");
  menuContainer.classList.add("menu-container");

  // create the menu options
  const option1 = document.createElement("button");
  option1.innerText = "Domination";
  option1.classList.add("menu-option");
  option1.classList.add("option-1");

  const option2 = document.createElement("button");
  option2.innerText = "New Game";
  option2.classList.add("menu-option");
  option2.classList.add("option-2");

  const option3 = document.createElement("button");
  option3.innerText = "Option 3";
  option3.classList.add("menu-option");
  option3.classList.add("option-3");

  const option4 = document.createElement("button");
  option4.innerText = "Option 4";
  option4.classList.add("menu-option");
  option4.classList.add("option-4");

  // add event listener to Option 2 button
  option2.addEventListener("click", function() {
    toggleTableContainer(true);
    blurEffect(1);
    document.getElementById("menu-container").style.display = "none";
    gameInProgress = true;
    menuState = false;
  });

  // add the menu options to the menu container
  menuContainer.appendChild(option1);
  menuContainer.appendChild(option2);
  menuContainer.appendChild(option3);
  menuContainer.appendChild(option4);

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
    toggleTableContainer(true);
    blurEffect(1);
    document.getElementById("menu-container").style.display = "none";
    menuState = false;
  }
});

