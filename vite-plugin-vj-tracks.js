import { readdirSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Auto-generate public/tracks/tracks.json from the .mp3s in public/tracks/, so the
// playlist stays in sync with the folder- drop an mp3 in, it joins the show; remove
// it, it's gone. The dev server regenerates + reloads on add/unlink; builds write once.
//
// Reuse in your own Vite project: copy this one file to your project root, then in
// vite.config.js:
//   import vjTracksPlugin from './vite-plugin-vj-tracks.js'
//   export default defineConfig( { plugins: [ vjTracksPlugin() ] } )
export default function vjTracksPlugin() {
	const dir = resolve( process.cwd(), 'static/tracks' )
	const writeTracksJson = () => {
		if ( !existsSync( dir ) ) return
		const files = readdirSync( dir )
			.filter( ( f ) => f.endsWith( '.mp3' ) )
			.sort()
			.map( ( f ) => `/tracks/${ f }` )
		writeFileSync( resolve( process.cwd(), 'static/tracks/tracks.json' ), JSON.stringify( files, null, 2 ) )
	}
	return {
		name: 'vj-tracks',
		buildStart() {
			writeTracksJson()
		},
		configureServer( server ) {
			writeTracksJson()
			server.watcher.add( dir )
			const reload = ( p ) => {
				if ( ! String( p ).includes( 'static/tracks' ) ) return
				writeTracksJson()
				server.ws.send( { type: 'full-reload' } )
			}
			for ( const ev of [ 'add', 'unlink' ] ) server.watcher.on( ev, reload )
		}
	}
}

// import { readdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
// import { resolve } from 'node:path'

// // Génère static/tracks/tracks.json à partir des .mp3 présents dans static/tracks/.
// // Déposer un mp3 → il rejoint la playlist ; le retirer → il disparaît.
// export default function vjTracksPlugin() {
//     const dir = resolve( process.cwd(), 'static/tracks' )   // ← TON dossier (pas public/)
//     const file = resolve( dir, 'tracks.json' )

//     const writeTracksJson = () => {
//         if ( !existsSync( dir ) ) return
//         const files = readdirSync( dir )
//             .filter( ( f ) => f.endsWith( '.mp3' ) )
//             .sort()
//             .map( ( f ) => `/tracks/${ f }` )   // l'URL reste /tracks/ (static/ est servi à la racine)
//         const next = JSON.stringify( files, null, 2 )
//         const prev = existsSync( file ) ? readFileSync( file, 'utf8' ) : ''
//         if ( next !== prev ) writeFileSync( file, next )   // n'écrit QUE si la liste a changé
//     }

//     return {
//         name: 'vj-tracks',
//         buildStart() { writeTracksJson() },
//         configureServer( server ) {
//             writeTracksJson()
//             server.watcher.add( dir )
//             const reload = ( p ) => {
//                 if ( ! String( p ).includes( 'static/tracks' ) ) return
//                 if ( String( p ).endsWith( 'tracks.json' ) ) return   // ignore son propre fichier
//                 writeTracksJson()
//                 server.ws.send( { type: 'full-reload' } )
//             }
//             for ( const ev of [ 'add', 'unlink' ] ) server.watcher.on( ev, reload )
//         }
//     }
// }