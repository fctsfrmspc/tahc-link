// for polls (TODO: turn this into a class...)
let currentPoll = {}
let pollVoters = {}
let pollRunning = false
let pollRunner = []
let pollTotalVotes = 0
let pollExpiryTimeout = null
let pollMinAnswers = 1
let pollMaxAnswers = 1
let pollChannel = null

let bot = null

bot.on("message", async message => {
    if (message.content.startsWith('!poll')) {
        const authorId = message.author.id
        let nickname = "Anonymous"
        if (message.channel.type === "text") {
            nickname = message.channel.members.get(authorId).displayName
        }
        if (message.content.startsWith('!poll new')) {
            if (message.channel.type === "dm") {
                message.reply("umfragen bitte nicht im privatchat erstellen...")
                return
            }
            if (pollRunning) {
                message.reply("es läuft bereits eine umfrage! (beenden mit `!poll end` oder anzeigen mit `!poll`)")
                return
            }
            const alphabet = [...Array(26)].map(a=>a = String.fromCharCode(i++),i=65)
            let qAndA = message.content.substring(9).split(";").map(str => str.trim())
            if (qAndA[qAndA.length - 1].length === 0) qAndA.pop() // delete last answer if last letter was ";"
            if (qAndA.length > alphabet.length) {
                return message.reply("zu viele antwortmöglichkeiten... maximal 26 sind erlaubt")
            }
            if (qAndA.length < 3) {
                return message.reply("es muss mindestens 2 antwortmöglichkeiten geben... frage und antworten werden mit einem semikolon getrennt.")
            }
            let question = qAndA.shift()
            // check whether new poll is multiple-choice (!poll new <min>:<max> question; ...)
            if (question.indexOf(":") != -1 && question.indexOf(" ") != -1) {
                const q_split = question.split(" ")
                const numbers = q_split[0]
                if (numbers.indexOf(":") != -1) {
                    const minMax = numbers.split(":").map(str => Number.parseInt(str))
                    // if x:y aren't numbers, interpret them as part of the question (no multi)
                    if (!isNaN(minMax[0]) && !isNaN(minMax[1])) {
                        if (minMax[1] <= qAndA.length) {
                            if (minMax[0] <= minMax[1]) {
                                if (minMax[0] > 0) {
                                    pollMinAnswers = minMax[0]
                                    pollMaxAnswers = minMax[1]
                                    question = q_split.slice(1, q_split.length).join(" ")
                                } else {
                                    return message.reply(`die mindestanzahl an antworten (${minMax[0]}) muss größer als 0 sein...`)
                                }
                            } else {
                                return message.reply(`die mindestanzahl an antworten (${minMax[0]}) ist größer als die maximalanzahl... (${minMax[1]})`)
                            }
                        } else {
                            return message.reply(`die maximale anzahl an wählbaren antworten (${minMax[1]}) überschreitet die anzahl der antworten... (${qAndA.length})`)
                        }
                    }
                }
            }
            currentPoll.q = question
            currentPoll.a = {}
            for (let qA of qAndA) {
                const thisLetter = alphabet.shift()
                currentPoll.a[thisLetter] = {
                    "text": qA,
                    "votes": 0,
                    "votedUsers": []
                }
            }
            // default: 24 hours until expiry
            pollExpiryTimeout = setTimeout(() => {
                endPoll(false)
            }, 24 * 3600000)
            pollRunning = true
            pollRunner = [authorId, nickname]
            pollTotalVotes = 0
            pollVoters = {}
            pollChannel = message.channel
            displayPoll(true)
        } else {
            if (pollRunning) {
                if (message.content.startsWith('!poll extend')) {
                    // reset the timer
                    if (authorId === pollRunner[0]) {
                        clearTimeout(pollExpiryTimeout)
                        pollExpiryTimeout = setTimeout(() => {
                            endPoll(false)
                        }, 24 * 3600000)
                        message.reply("die umfrage wurde um 24 stunden verlängert.")
                    } else {
                        message.reply(`nur ${pollRunner[1]} kann diese Umfrage verlängern`)
                    }
                }
                else if (message.content.startsWith('!poll end')) {
                    // show final results
                    if (authorId === pollRunner[0]) {
                        endPoll(true)
                    } else {
                        message.reply(`nur ${pollRunner[1]} kann diese Umfrage beenden`)
                    }
                }
                else if (message.content === "!poll unvote") {
                    if (pollVoters.hasOwnProperty(authorId)) {
                        for (let votedAnswer of pollVoters[authorId].votedFor) {
                            const votedUsersIndex = currentPoll.a[votedAnswer].votedUsers.indexOf(authorId)
                            currentPoll.a[votedAnswer].votedUsers.splice(votedUsersIndex, 1)
                            currentPoll.a[votedAnswer].votes--
                            pollTotalVotes--
                        }
                        delete pollVoters[authorId]
                        displayPoll(false)
                    } else {
                        message.reply("du hast noch nicht abgestimmt!")
                    }
                }
                else if (message.content === "!poll") {
                    displayPoll(false)
                }
                else {
                    // vote
                    // check whether user has reached max allowed votes
                    let alreadyVoted = []
                    if (pollVoters.hasOwnProperty(authorId)) {
                        alreadyVoted = pollVoters[authorId].votedFor
                        if (alreadyVoted.length === pollMaxAnswers) {
                            if (pollMaxAnswers === 1) {
                                return message.reply("du hast bereits abgestimmt!")
                            } else {
                                return message.reply("du hast die maximalzahl an votes erreicht!")
                            }
                        }
                    }
                    // extract votes
                    const voteString = message.content.substring(6)
                    let votedLetters = []
                    if (voteString.indexOf(",") != -1) {
                        votedLetters = voteString.split(",").map(str => str.trim().toUpperCase())
                    } else if (voteString.indexOf(";") != -1) {
                        votedLetters = voteString.split(";").map(str => str.trim().toUpperCase())
                    } else {
                        votedLetters = [voteString.trim().toUpperCase()]
                    }
                    // match number of votes and allowed no. of votes
                    if ((votedLetters.length + alreadyVoted.length) > pollMaxAnswers) {
                        return message.reply(`du darfst insgesamt maximal ${pollMaxAnswers} stimmen abgeben!`)
                    } else if ((votedLetters.length + alreadyVoted.length) < pollMinAnswers) {
                        return message.reply(`du musst mindestens ${pollMinAnswers} stimmen abgeben!`)
                    } else {
                        for (let vote of votedLetters) {
                            // check if voted letters are valid
                            if (!currentPoll.a.hasOwnProperty(vote)) {
                                return message.reply(`antwort "${vote}" nicht gefunden. mögliche antworten: ${Object.keys(currentPoll.a).join(", ")}`)
                            }
                            // check of user has already voted for this answer
                            if (currentPoll.a[vote].votedUsers.includes(authorId)) {
                                return message.reply(`du hast bereits für antwort ${vote} abgestimmt!`)
                            }
                        }
                        // add vote(s)
                        for (let vote of votedLetters) {
                            currentPoll.a[vote].votes++
                            currentPoll.a[vote].votedUsers.push(authorId)
                        }
                        pollTotalVotes += votedLetters.length
                        // update user
                        if (alreadyVoted.length > 0) {
                            pollVoters[authorId].votedFor = alreadyVoted.concat(votedLetters)
                            pollVoters[authorId].name = nickname // name may have changed, overwrite
                        } else {
                            pollVoters[authorId] = { "votedFor": votedLetters, "name": nickname }
                        }
                        displayPoll(false)
                    }
                }
            } else {
                message.reply("es läuft momentan keine umfrage. erstelle eine neue mit `!poll new Frage; Antwort A; Antwort B; Antwort C; ...` (achtung: semikolon!)")
            }
        }
    }
});

// for polls

function sortPollAfterVotes() {
    let pollAnswerCounts = []
    for (let answer of Object.keys(currentPoll.a)) {
        pollAnswerCounts.push([answer, currentPoll.a[answer].votes])
    }
    pollAnswerCounts.sort(function(a, b) {
        return b[1] - a[1]
    })
    return pollAnswerCounts
}

function displayPoll(created) {
    if (!pollChannel)
        return
    
    const pollAnswerCounts = sortPollAfterVotes()
    let outputString = ""
    if (created) {
        outputString = `${pollRunner[1]} möchte wissen:\n`
    }
    outputString += `**${currentPoll.q}**\n`
    for (let answer of pollAnswerCounts) {
        const answerLetter = answer[0]
        const theseVotes = answer[1]
        const theseVoters = currentPoll.a[answerLetter].votedUsers.map(user => pollVoters[user].name).join(", ") // get nicknames
        const s = (theseVotes === 1) ? "vote" : "votes"
        outputString += `**${answerLetter}** - ${currentPoll.a[answerLetter].text} (${theseVotes} ${s})\n`
        if (theseVotes > 0) {
            outputString += `*voted by: ${theseVoters}*\n`
        }
    }
    outputString += `insgesamt: ${pollTotalVotes}\n`
    // multiple-choice?
    if (pollMaxAnswers > 1) {
        outputString += "Dies ist eine **Multiple-Choice**-Umfrage. "
        if (pollMinAnswers === pollMaxAnswers) {
            outputString += `Es müssen genau **${pollMinAnswers} Stimmen** abgegeben werden.\n`
        } else {
            outputString += `Es müssen mindestens **${pollMinAnswers}**, aber maximal **${pollMaxAnswers} Stimmen** abgegeben werden.\n`
        }
        outputString += "Um abzustimmen, sende `!poll` und die Antwortbuchstaben (z.B. `!poll A, B`)"
    } else {
        outputString += "Um abzustimmen, sende `!poll` und den Antwortbuchstaben (z.B. `!poll A`)"
    }
    pollChannel.send(outputString)
}

function endPoll(creatorEnded) {
    // reset everything and show result
    let pollAnswerCounts = sortPollAfterVotes()
    let outputString = ""
    if (creatorEnded) {
        outputString += `Der Fragesteller hat die aktuelle Umfrage beendet.\n`
    } else {
        outputString += `Die aktuelle Umfrage wurde nach Ablauf der Zeit automatisch beendet.\n`
    }
    outputString += `Q: **${currentPoll.q}**\n`
    // multiple answers won?
    let prevVotes = pollAnswerCounts[0][1]
    if (prevVotes === 0) {
        outputString += "Es wurden keine Stimmen abgegeben."
    } else {
        let pollAnswerCountsWon = [pollAnswerCounts.shift()]
        for (let answer of pollAnswerCounts) {
            if (answer[1] === prevVotes) {
                pollAnswerCountsWon.push(answer)
            } else {
                break
            }
            prevVotes = answer[1]
        }
        if (pollAnswerCountsWon.length === 1) {
            const winner = pollAnswerCountsWon[0]
            const percentVotes = (winner[1] > 0) ? winner[1] / pollTotalVotes * 100 : 0
            const theseVoters = currentPoll.a[winner[0]].votedUsers.map(user => pollVoters[user].name).join(", ") // get nicknames
            const n = (winner[1] === 1) ? "Stimme" : "Stimmen"
            outputString += `Gewonnen hat:\n`
            outputString += `**${currentPoll.a[winner[0]].text}**\n`
            outputString += `mit **${winner[1]}** ${n} (${percentVotes.toFixed(0)}%), gewählt von: ${theseVoters}`
        } else if (pollAnswerCountsWon.length > 1) {
            const percentVotes = (prevVotes > 0) ? prevVotes / pollTotalVotes * 100 : 0
            const n = (prevVotes === 1) ? "Stimme" : "Stimmen"
            outputString += `Gewonnen haben:\n`
            for (let winner of pollAnswerCountsWon) {
                outputString += `**${currentPoll.a[winner[0]].text}**\n`
            }
            outputString += `mit jeweils **${pollAnswerCountsWon[0][1]}** ${n}! (${percentVotes.toFixed(0)}%)`
        } else {
            outputString += `beim zusammenzählen der ergebnisse ist ein fehler aufgetreten...`
            log("endPoll", `pollAnswerCounts: ${pollAnswerCounts}`)
            log("endPoll", `pollAnswerCountsWon: ${pollAnswerCountsWon}`)
        }	
    }	
    currentPoll = {}
    pollVoters = {}
    pollRunning = false
    pollRunner = []
    pollTotalVotes = 0
    pollMinAnswers = 1
    pollMaxAnswers = 1
    clearTimeout(pollExpiryTimeout)
    pollChannel.send(outputString)
    pollChannel = null
}