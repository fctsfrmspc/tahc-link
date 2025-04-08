import fetch from 'node-fetch'
import fs from 'fs'

function matchesQuery(query, name) {
    if (!name) return
    let nlow = name.toLowerCase()
    return query.toLowerCase().split(' ').every(word => nlow.includes(word))
}

const fetchEvil = async (query) => {
    const url = 'https://3v1l.bplaced.net/gamelog/api/games'
    
    const res = await fetch(url)
    console.log(`whoplayed: response from ${url}: status ${res.status} ${res.statusText}`)
    if (!res.ok) return
      
    const json = await res.json()
    const filterednames = json.reduce((acc, game) => {
    	if (matchesQuery(query, game.name)) {
            if (game.extra)
                acc.push(`${game.name} [${game.extra}]`)
            else
                acc.push(game.name)
        }
        return acc
    }, [])
    
    if (filterednames.length > 0)
	    return `**Evil**: ${filterednames.sort().join(", ")}`
}

const fetchFrabbs = async (query) => {
    const url = 'https://us-central1-businessdog-70c32.cloudfunctions.net/getGameRatings'
   
    const res = await fetch(url)
    console.log(`whoplayed: response from ${url}: status ${res.status} ${res.statusText}`)
       if (!res.ok) return
      
    const json = await res.json()
    const filterednames = json.games.reduce((acc, game) => {
    		if (matchesQuery(query, game.title)) {
        	acc.push(game.title)
        }
        return acc
    }, [])
    
    if (filterednames.length > 0)
	    return `**Frabbs**: ${filterednames.sort().join(", ")}`
}

const fetchGG = async (query) => {
    const url = `https://rateth.at/api/rating/search_title.php?article_id=1`
    
    const res = await fetch(url)
    console.log(`whoplayed: response from ${url}: status ${res.status} ${res.statusText}`)
    if (!res.ok) return
      
    const json = await res.json()
    const filterednames = json.reduce((acc, game) => {
        if (matchesQuery(query, game.name)) {
            acc.push(game.name)
        }
        return acc
    }, [])
    
    if (filterednames.length > 0)
    	return `**GG**: ${filterednames.sort().join(", ")}`
}

const fetchVxb = async (query) => {
    const url = 'https://retroachievements.org/API/API_GetUserCompletedGames.php?u=vaanxbahn&y=bJekLmzjkkmNcDl7PmbGFrZHAEoPsmSJ'
    
    const res = await fetch(url)
    console.log(`whoplayed: response from ${url}: status ${res.status} ${res.statusText}`)
    if (!res.ok) return
      
    const json = await res.json()
    const filterednames = json.reduce((acc, game) => {
        if (matchesQuery(query, game.Title) 
            && !game.Title.includes('[Subset') 
            && !game.Title.startsWith('~')) {
            if (Number.isInteger(game.MaxPossible) && Number.isInteger(game.NumAwarded)) {
                if (game.NumAwarded > (game.MaxPossible * 0.5))
                    acc.push(game.Title)
            } else {
                acc.push(game.Title)
            }
        }
        return acc
    }, [])
    
    const unique = [...new Set(filterednames)];
    
    if (unique.length > 0)
    	return `**VxB**: ${unique.sort().join(", ")}`
}

const fetchLamech = async (query) => {
    const filepath = './whoplayed/lamech.json'
    
    if (!fs.existsSync(filepath)) {
        console.log(`whoplayed: file ${filepath} could not be found or opened`)
	    return
    }
    const json = JSON.parse(fs.readFileSync(filepath, 'utf8'))

    const filterednames = json.reduce((acc, name) => {
        if (matchesQuery(query, name)) {
            acc.push(name)
        }
        return acc
    }, [])
    
    if (filterednames.length > 0)
    	return `**Lamech**: ${filterednames.sort().join(", ")}`
}

async function whoPlayed(query) {
    
    let res = "nobody"
    res = await Promise.all([fetchEvil(query), fetchFrabbs(query), fetchGG(query), fetchVxb(query), fetchLamech(query)])
	.then(results => {
        let filteredres = results.filter(res => typeof res !== 'undefined')
        if (filteredres.length == 0)
            return "hat keiner gespielt"
	    return (filteredres.join("\n"))
	})
	.catch(error => {
	    console.error('whoplayed: An error occurred:', error);
	})

    return res
}

export { whoPlayed }
