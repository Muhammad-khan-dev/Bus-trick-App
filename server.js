const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const STOPS = [
    { id: 1, name: "Main Campus UET", lat: 33.9983, lng: 71.4853 },
    { id: 2, name: "Tarnab Farm",     lat: 34.0080, lng: 71.6850 },
    { id: 3, name: "Pabbi",           lat: 34.0115, lng: 71.7950 },
    { id: 4, name: "Jalozai Campus",  lat: 33.8950, lng: 71.8150 }
];

let currentBusLocation = null;
let lastPassedStopId = 0; // Track karega ke bus ne aakhri stop kaunsa cross kiya hai

// Distance Calculate karne ka formula (Kilometers mein)
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

io.on('connection', (socket) => {
    // Student ko stops bhejna
    socket.emit('stopsList', STOPS);
    if (currentBusLocation) {
        socket.emit('busLocationUpdate', currentBusLocation);
    }

    // 🔴 Jab DRIVER apni live location bheje
    socket.on('updateLocation', (location) => {
        currentBusLocation = location;
        io.emit('busLocationUpdate', location); // Sab students ko bhejo

        // Check karein kya bus kisi stop se guzar rahi hai (500 meter ke andar)
        STOPS.forEach(stop => {
            let dist = getDistance(location.lat, location.lng, stop.lat, stop.lng);
            if(dist < 0.5) { 
                if (stop.id > lastPassedStopId) lastPassedStopId = stop.id;
            }
        });
    });

    // 🔴 Jab STUDENT koi stop search kare
    socket.on('checkStopStatus', (selectedStopId) => {
        if (!currentBusLocation) {
            socket.emit('stopStatusResult', { message: "⚠️ Bus abhi start nahi hui ya driver offline hai.", stop: STOPS[0] });
            return;
        }

        const selectedStop = STOPS.find(s => s.id === parseInt(selectedStopId));
        if (!selectedStop) return;

        let statusMessage = "";

        if (lastPassedStopId >= selectedStop.id) {
            statusMessage = `❌ Bus **${selectedStop.name}** se nikal chuki hai!`;
        } else {
            // Falsa aur time calculate karein
            let dist = getDistance(currentBusLocation.lat, currentBusLocation.lng, selectedStop.lat, selectedStop.lng);
            let speedKmph = 30; // Bus ki average speed 30km/h
            let timeMins = Math.round((dist / speedKmph) * 60);

            statusMessage = `✅ Bus **${selectedStop.name}** par aane wali hai.<br>Faasla: ${dist.toFixed(1)} km | ETA: ~${timeMins} mins.`;
        }

        socket.emit('stopStatusResult', { message: statusMessage, stop: selectedStop });
    });

    socket.on('driverOffline', () => {
        currentBusLocation = null;
        lastPassedStopId = 0;
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server chal raha hai: http://localhost:${PORT}`));