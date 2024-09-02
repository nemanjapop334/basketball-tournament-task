const groups = require('./groups.json');


const minElo = 1200;
const maxElo = 1800;
const maxFIBARanking = 160;


function initializeTeams(groups) {
    const teams = {};
    for (const group of Object.values(groups)) {
        for (const team of group) {
            const normalizedRanking = (maxFIBARanking - team.FIBARanking) / (maxFIBARanking - 1); // Normalizacija rangiranja između 0 i 1
            teams[team.Team] = {
                ISOCode: team.ISOCode,
                FIBARanking: team.FIBARanking,
                EloRating: minElo + normalizedRanking * (maxElo - minElo), // Početni Elo rejting u opsegu između 1200 i 1800
                Points: 0,
                Wins: 0,
                Losses: 0,
                Scores: 0,
                Conceded: 0,
                Difference: 0,
                Matches: [],
            };
        }
    }
    return teams;
}

function probability(rating1, rating2) {
    return 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
}


function simulateMatch(teamA, teamB, K = 32) {
    const probA = probability(teamA.EloRating, teamB.EloRating);
    const probB = 1 - probA;


    const forfeitChanceA = Math.random();
    const forfeitChanceB = Math.random();

    let scoreA, scoreB;

    if (forfeitChanceA < 0.0001) {

        scoreA = 0;
        scoreB = 50;
        teamB.Points += 2;
        teamA.Points += 0;
        teamA.Scores += scoreA;
        teamA.Conceded += scoreB;
        teamB.Scores += scoreB;
        teamB.Conceded += scoreA;
    } else if (forfeitChanceB < 0.0001) {

        scoreA = 50;
        scoreB = 0;
        teamA.Points += 2;
        teamB.Points += 0;
        teamA.Scores += scoreA;
        teamA.Conceded += scoreB;
        teamB.Scores += scoreB;
        teamB.Conceded += scoreA;
    } else {

        const baseScoreA = 50 + 30 * (probA - 0.5);
        const baseScoreB = 50 + 30 * (probB - 0.5);

        const boostA = probA > 0.6 ? Math.random() * 20 * probA : 0;
        const boostB = probB > 0.6 ? Math.random() * 20 * probB : 0;

        scoreA = Math.round(Math.max(50, (Math.random()) * 60 + boostA + baseScoreA));
        scoreB = Math.round(Math.max(50, (Math.random()) * 60 + boostB + baseScoreB));


        if (scoreA === scoreB) {

            const overtimeChance = Math.random();
            const overtimeBoost = Math.round(Math.random() * 10);
            if (overtimeChance > 0.5) {
                scoreA += overtimeBoost;
            } else {
                scoreB += overtimeBoost;
            }
        }


        teamA.Scores += scoreA;
        teamA.Conceded += scoreB;
        teamB.Scores += scoreB;
        teamB.Conceded += scoreA;



        teamA.Difference += scoreA - scoreB;
        teamB.Difference += scoreB - scoreA;

        const outcome = scoreA > scoreB ? 1 : 0;

        if (outcome === 1) {
            teamA.Wins += 1;
            teamB.Losses += 1;
            teamA.Points += 2;
            teamB.Points += 1;
        } else {
            teamB.Wins += 1;
            teamA.Losses += 1;
            teamB.Points += 2;
            teamA.Points += 1;
        }


        teamA.EloRating += K * (outcome - probA);
        teamB.EloRating += K * ((1 - outcome) - probB);
    }


    teamA.Matches.push({ opponent: teamB.ISOCode, scoreA: scoreA, scoreB: scoreB, Difference: scoreA - scoreB, outcome: scoreA > scoreB ? 1 : 0 });
    teamB.Matches.push({ opponent: teamA.ISOCode, scoreA: scoreB, scoreB: scoreA, Difference: scoreB - scoreA, outcome: scoreA < scoreB ? 1 : 0 });

    return { teamA: scoreA, teamB: scoreB };
}



function simulateGroupPhase(groups, teams) {
    const results = {};
    for (const group in groups) {
        results[group] = [];
        const groupTeams = groups[group];
        for (let i = 0; i < groupTeams.length; i++) {
            for (let j = i + 1; j < groupTeams.length; j++) {
                const teamA = teams[groupTeams[i].Team];
                const teamB = teams[groupTeams[j].Team];
                const result = simulateMatch(teamA, teamB);
                results[group].push({
                    teamA: teamA.ISOCode,
                    teamB: teamB.ISOCode,
                    scoreA: result.teamA,
                    scoreB: result.teamB
                });
            }
        }
    }
    return results;
}


function printGroupPhaseResults(results) {
    for (const group in results) {
        console.log(`Grupa ${group}:`);
        for (const match of results[group]) {
            console.log(`${match.teamA} - ${match.teamB} (${match.scoreA}:${match.scoreB})`);
        }
        console.log('');
    }
}




const teams = initializeTeams(groups);


const resultsByGroup = simulateGroupPhase(groups, teams);


printGroupPhaseResults(resultsByGroup);




function mergeGroupData(groups, teams) {
    const mergedGroups = {};

    for (const group in groups) {
        mergedGroups[group] = groups[group].map(team => {
            const teamName = team.Team;
            const teamData = teams[teamName];

            return {
                ...team,
                ...teamData
            };
        });
    }

    return mergedGroups;
}

const data = mergeGroupData(groups, teams);






function rankTeams(groups) {
    function getTeamData(group) {
        return group.map(team => {
            const scores = team.Matches.map(match => match.scoreA);
            const conceded = team.Matches.map(match => match.scoreB);
            const difference = team.Matches.reduce((sum, match) => sum + match.Difference, 0);
            return {
                name: team.Team,
                points: team.Points,
                wins: team.Wins,
                losses: team.Losses,
                scores: scores.reduce((sum, score) => sum + score, 0),
                conceded: conceded.reduce((sum, score) => sum + score, 0),
                difference: difference,
                matches: team.Matches
            };
        });
    }

    function sortTeams(teams) {
        return teams.sort((a, b) => b.points - a.points || b.difference - a.difference || b.scores - a.scores);
    }

    function resolveTies(teams) {
        let sortedTeams = sortTeams(teams);
        for (let i = 0; i < sortedTeams.length; i++) {
            for (let j = i + 1; j < sortedTeams.length; j++) {
                if (sortedTeams[i].points === sortedTeams[j].points) {
                    // Check head-to-head results
                    const headToHead = sortedTeams[i].matches.find(match => match.opponent === sortedTeams[j].name);
                    if (headToHead) {
                        if (headToHead.outcome === 1) {
                            [sortedTeams[i], sortedTeams[j]] = [sortedTeams[j], sortedTeams[i]];
                        }
                    } else {
                        // Handle circle formation if necessary
                        const commonTeams = [sortedTeams[i].name, sortedTeams[j].name];
                        const headToHeadResults = commonTeams.map(teamName => {
                            const team = sortedTeams.find(t => t.name === teamName);
                            return team.matches.find(match => match.opponent === commonTeams.find(t => t !== teamName));
                        });

                        const winsInCommon = headToHeadResults.filter(result => result && result.outcome === 1).length;
                        if (winsInCommon > 0) {
                            [sortedTeams[i], sortedTeams[j]] = [sortedTeams[j], sortedTeams[i]];
                        }
                    }
                }
            }
        }
        return sortedTeams;
    }

    function createStandingsObject(groups) {
        const standings = {};
        for (const [groupName, groupData] of Object.entries(groups)) {
            const teams = getTeamData(groupData);
            const sortedTeams = resolveTies(teams);
            standings[groupName] = sortedTeams.map((team, index) => ({
                rank: index + 1,
                name: team.name,
                wins: team.wins,
                losses: team.losses,
                points: team.points,
                scores: team.scores,
                conceded: team.conceded,
                difference: team.difference
            }));
        }
        return standings;
    }

    function printStandings(standings) {
        console.log("Konačan plasman u grupama:");
        for (const [groupName, teams] of Object.entries(standings)) {
            console.log(`    Grupa ${groupName} (Ime - pobede/porazi/bodovi/postignuti koševi/primljeni koševi/koš razlika):`);
            teams.forEach(team => {
                console.log(`        ${team.rank}. ${team.name.padEnd(12)} ${team.wins} / ${team.losses} / ${team.points} / ${team.scores} / ${team.conceded} / ${team.difference >= 0 ? `+${team.difference}` : team.difference}`);
            });
            console.log('');
        }
    }

    const standings = createStandingsObject(groups);
    printStandings(standings);
    return standings;
}

const standings = rankTeams(data);


function rankTopTeams(standings) {
    const topTeams = {
        firstPlace: [],
        secondPlace: [],
        thirdPlace: []
    };

    // Extract top teams from each group
    for (const [groupName, teams] of Object.entries(standings)) {
        topTeams.firstPlace.push(teams[0]);  // First place team
        topTeams.secondPlace.push(teams[1]); // Second place team
        topTeams.thirdPlace.push(teams[2]);  // Third place team
    }

    // Function to sort teams based on points, point difference, and scores
    function sortTeams(teams) {
        return teams.sort((a, b) =>
            b.points - a.points ||
            b.difference - a.difference ||
            b.scores - a.scores
        );
    }

    // Rank teams within each category
    topTeams.firstPlace = sortTeams(topTeams.firstPlace);
    topTeams.secondPlace = sortTeams(topTeams.secondPlace);
    topTeams.thirdPlace = sortTeams(topTeams.thirdPlace);

    // Assign overall ranks
    const overallRanking = [
        ...topTeams.firstPlace,
        ...topTeams.secondPlace,
        ...topTeams.thirdPlace
    ].map((team, index) => ({
        ...team,
        rank: index + 1
    }));

    // Separate teams advancing to knockout stage (1-8) and the team not advancing (9)
    const advancingTeams = overallRanking.slice(0, 8);
    const nonAdvancingTeam = overallRanking[8];

    // Output results

    console.log("\nTimovi koji prolaze u eliminacionu fazu:");
    advancingTeams.forEach(team => {
        console.log(`${team.rank}. ${team.name.padEnd(20)} ${team.wins} / ${team.losses} / ${team.points} / ${team.scores} / ${team.conceded} / ${team.difference >= 0 ? `+${team.difference}` : team.difference}`);
    });

    console.log("\nTim koji ne nastavlja takmičenje:");
    if (nonAdvancingTeam) {
        console.log(`${nonAdvancingTeam.rank}. ${nonAdvancingTeam.name.padEnd(20)} ${nonAdvancingTeam.wins} / ${nonAdvancingTeam.losses} / ${nonAdvancingTeam.points} / ${nonAdvancingTeam.scores} / ${nonAdvancingTeam.conceded} / ${nonAdvancingTeam.difference >= 0 ? `+${nonAdvancingTeam.difference}` : nonAdvancingTeam.difference}`);
    }

    return {
        advancingTeams,
        nonAdvancingTeam
    };
}

rankTopTeams(standings);