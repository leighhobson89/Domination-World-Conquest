<?php

header("Access-Control-Allow-Origin: *");


// Replace with your own database credentials
$servername = "localhost";
$username = "leighhobson89";
$password = "1066wtboH!";
$dbname = "countryDb";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Retrieve data for selected country
$country = $_POST["country"]; // Replace with the name of the variable sent from the frontend
$sql = "SELECT * FROM country WHERE country = '" . $country . "'";
$result = $conn->query($sql);

// Send data back to frontend
if ($result->num_rows > 0) {
    $data = array();
    while($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
    echo json_encode($data);
} else {
    echo "0 results";
}

$conn->close();

?>
