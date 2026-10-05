const DISCORD_MAX_CHARS = 2000
const RA_API_KEY = 'bJekLmzjkkmNcDl7PmbGFrZHAEoPsmSJ'

function matchesQuery(query, name) {
    if (!name) return false

    const nlow = name.toLowerCase()
    return query.toLowerCase().split(' ').every(word => nlow.includes(word))
}

function uniqueSorted(games) {
    return [...new Set(games)].sort()
}

function normalizeGameName(name) {
    return name
        .trim()
        .replace(/\s+/g, ' ')
}

function makeResult(name, games) {
    const unique = uniqueSorted(
        games
            .map(normalizeGameName)
            .filter(Boolean)
    )

    if (unique.length === 0) return undefined

    return {
        name,
        games: unique,
        hidden: 0
    }
}

function formatPerson(person) {
    if (person.hidden === 0) {
        return `**${person.name}**: ${person.games.join(", ")}`
    }

    return `**${person.name}**: ${person.games.join(", ")}, (+ ${person.hidden} more)`
}

function formatResults(people) {
    let output = people.map(formatPerson).join("\n")

    while (output.length > DISCORD_MAX_CHARS) {
        const candidates = people
            .filter(person => person.games.length > 1)
            .sort((a, b) => b.games.length - a.games.length)

        if (candidates.length === 0) break

        const longest = candidates[0]
        longest.games.pop()
        longest.hidden++

        output = people.map(formatPerson).join("\n")
    }

    if (output.length > DISCORD_MAX_CHARS) {
        return output.slice(0, DISCORD_MAX_CHARS - 3) + "..."
    }

    return output
}

const fetchEvil = async (query) => {
    const url = 'https://3v1l.bplaced.net/gamelog/api/games'

    const res = await fetch(url)
    console.log(`whoplayed: response from ${url}: status ${res.status} ${res.statusText}`)
    if (!res.ok) return

    const json = await res.json()

    const games = json.reduce((acc, game) => {
        if (matchesQuery(query, game.name)) {
	    let game_entry = game.name
	    
            if (game.extra) {
		let game_extra = (game.extra == "Remake") ? game.year : game.extra
                game_entry += ` [${game_extra}]`
	    }
            if (game.date_completed == "0000-00-00")
                game_entry += ` [unf]`
		
	    acc.push(game_entry)
        }

        return acc
    }, [])

    return makeResult("Evil", games)
}

const fetchFrabbs = async (query) => {
    const url = 'https://www.businessdog.at/api/games'

    const res = await fetch(url)
    console.log(`whoplayed: response from ${url}: status ${res.status} ${res.statusText}`)
    if (!res.ok) return

    const json = await res.json()

    const games = json.games.reduce((acc, game) => {
        if (matchesQuery(query, game.title)) {
            acc.push(game.title)
        }

        return acc
    }, [])

    return makeResult("Frabbs", games)
}

const fetchGG = async (query) => {
    const url = 'https://rateth.at/api/rating/search_title.php?article_id=1'

    const res = await fetch(url)
    console.log(`whoplayed: response from ${url}: status ${res.status} ${res.statusText}`)
    if (!res.ok) return

    const json = await res.json()

    const games = json.reduce((acc, game) => {
        if (matchesQuery(query, game.name)) {
            acc.push(`${game.name} (${game.rate})`)
        }

        return acc
    }, [])

    return makeResult("GG", games)
}

const fetchVxb = async (query) => {
    const pageSize = 500
    let offset = 0
    let games = []

    while (true) {
        const url = `https://retroachievements.org/API/API_GetUserCompletionProgress.php?u=vaanxbahn&y=${RA_API_KEY}&c=${pageSize}&o=${offset}`

        const res = await fetch(url)
        console.log(`whoplayed: response from ${url}: status ${res.status} ${res.statusText}`)
        if (!res.ok) return

        const json = await res.json()
        const results = json?.Results

        if (!Array.isArray(results)) break

        for (const game of results) {
            if (
                matchesQuery(query, game.Title) &&
                !game.Title.includes('[Subset') &&
                !game.Title.startsWith('~')
            ) {
                if (game.HighestAwardKind) {
                    games.push(game.Title)
                } else {
                    games.push(`${game.Title} [unf]`)
                }
            }
        }

        if (results.length < pageSize) break

        offset += pageSize
    }

    return makeResult("VxB", games)
}

const fetchLamech = async (query) => {
    const url = 'https://www.businessdog.at/api/ariamis-games?keyword=' + encodeURIComponent(query)

    const res = await fetch(url)
    console.log(`whoplayed: response from ${url}: status ${res.status} ${res.statusText}`)
    if (!res.ok) return

    const json = await res.json()
    const seen = new Set()

    const games = json.games.reduce((acc, game) => {
        if (
            matchesQuery(query, game.title) &&
            !seen.has(game.title) &&
            game.completions > 0
        ) {
            if (game.rating) {
                acc.push(`${game.title} (${game.rating})`)
            } else {
                acc.push(game.title)
            }

            seen.add(game.title)
        }

        return acc
    }, [])

    return makeResult("Ariamis", games)
}

async function whoPlayed(query) {
    try {
        const results = await Promise.all([
            fetchEvil(query),
            fetchFrabbs(query),
            fetchGG(query),
            fetchVxb(query),
            fetchLamech(query)
        ])

        const filteredres = results.filter(Boolean)

        if (filteredres.length === 0) {
            return "hat keiner gespielt"
        }

        return formatResults(filteredres)
    } catch (error) {
        console.error('whoplayed: An error occurred:', error)
        return "fehler beim suchen"
    }
}

export { whoPlayed }
