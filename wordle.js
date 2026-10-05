import path from 'path'
import fs from 'fs'

function readWordle() {
    // Read the CSV file
    const csvPath = '../wordle_results.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',');
    
    const results = [];
    for (let i = 1; i < lines.length; i++) {
        const [date, user, attempts] = lines[i].split(',');
        results.push({
            date,
            user,
            attempts: parseInt(attempts)
        });
    }
    
    // Group results by user
    const userData = {};
    for (const { date, user, attempts } of results) {
        if (!userData[user]) {
            userData[user] = [];
        }
        userData[user].push(attempts);
    }
    
    // Calculate statistics and sort by average attempts
    const userStats = [];
    for (const [username, attemptsList] of Object.entries(userData)) {
        const avgAttempts = attemptsList.reduce((a, b) => a + b, 0) / attemptsList.length;
        const totalDays = attemptsList.length;
        const firstTries = attemptsList.filter(a => a === 1).length;
        
        userStats.push({
            username,
            avgAttempts,
            totalDays,
            firstTries
        });
    }
    
    userStats.sort((a, b) => a.avgAttempts - b.avgAttempts);
    
    // Format as string
    let statsString = '\:regional_indicator_w: \:regional_indicator_o: \:regional_indicator_r: \:regional_indicator_d: \:regional_indicator_l: \:regional_indicator_e:'
    statsString += '```'
    statsString += '================================================\n';
    statsString += `${'User'.padEnd(15)} ${'Avg Atmpt'.padEnd(10)} ${'Days Pld'.padEnd(10)} ${'1st Tries'.padEnd(10)}\n`;
    statsString += '================================================\n';
    
    for (const { username, avgAttempts, totalDays, firstTries } of userStats) {
        statsString += `${username.padEnd(15)} ${avgAttempts.toFixed(2).padEnd(10)} ${totalDays.toString().padEnd(10)} ${firstTries.toString().padEnd(10)}\n`;
    }
    
    statsString += '================================================';
    statsString += '```'
    
    return statsString;
}

export { readWordle }
