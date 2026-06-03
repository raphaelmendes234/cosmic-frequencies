import Experience from '../Experience'
import * as THREE from 'three'

export default class Manager
{
    constructor()
    {
        this.experience = new Experience()
        this.world = this.experience.world
        this.camera = this.experience.camera
        this.debug = this.experience.debug
        this.sound = this.experience.sound
        this.time = this.experience.time

        this.currentScene = 1

        this.sceneCount = 3
        this.auto = true          // changement automatique activé
        this.minDuration = 2     // durée quand le son est FORT (cuts rapides)
        this.maxDuration = 10    // durée quand le son est FAIBLE (cuts lents)
        this.volumeBoost = 3     // amplifie le volume (car volumeAverageSmooth reste bas)
        this.autoTimer = 0

        if(this.debug.active)
        {
            this.debugFolder = this.debug.gui.addFolder('MANAGER')
            this.sceneController = this.debugFolder.add(this, 'currentScene', { 'scene 1': 1, 'scene 2': 2, 'scene 3': 3 })
                .name('Change scene')
                .onChange(() => { this.switchScene(parseInt(this.currentScene)) })

            this.debugFolder.add(this, 'auto').name('auto switch')
            this.debugFolder.add(this, 'minDuration').min(1).max(20).step(1).name('durée mini (fort)')
            this.debugFolder.add(this, 'maxDuration').min(1).max(30).step(1).name('durée maxi (faible)')
            this.debugFolder.add(this, 'volumeBoost').min(1).max(10).step(0.1).name('sensibilité volume')
        }
    }

    switchScene(sceneNumber)
    {
        // On récupère les instances depuis World
        const helmet = this.world.helmet
        const astronaut = this.world.astronaut
        const eye = this.world.eye
        const beam = this.world.beam
        const stars = this.world.stars

        // Point central pour l'OrbitControls
        const centerTarget = new THREE.Vector3(0, 0, 0)

        switch(sceneNumber)
        {
            case 1:
                if(astronaut) { 
                    astronaut.show() 
                    astronaut.setMode(1)
                }
                if(helmet) helmet.show()
                if(eye) eye.hide()
                if(beam) beam.setMode(1)
                if(stars) stars.setMode(1)
                // Vue de face
                this.camera.cutToShot(new THREE.Vector3(0, 0, 8), centerTarget)
                break

            case 2:
                if(astronaut) { 
                    astronaut.show() 
                    astronaut.setMode(2)
                }
                if(helmet) helmet.show()
                if(eye) eye.hide()
                if(beam) beam.setMode(2)
                if(stars) stars.setMode(2)
                // Vue de 3/4 (on décale X et Z)
                this.camera.cutToShot(new THREE.Vector3(-3.5, 0.6, 4.3), new THREE.Vector3(5.8, -0.7, -2))
                break

            case 3:
                if(astronaut) astronaut.hide()
                if(helmet) helmet.hide()
                if(eye) eye.show()
                if(beam) beam.setMode(3)
                if(stars) stars.setMode(3)
                // Vue rapprochée pour l'oeil
                this.camera.cutToShot(new THREE.Vector3(0, 0, 8), centerTarget)
                break
        }
    }

    update() {
        if (!this.auto) return
        const s = this.sound

        // volume amplifié et borné 0..1
        const v = Math.min(s.volumeAverageSmooth * this.volumeBoost, 1)
        // interpolation inverse : v haut → durée courte, v bas → durée longue
        const targetDuration = this.maxDuration - v * (this.maxDuration - this.minDuration)

        this.autoTimer += this.time.delta * 0.001   // secondes

        if (this.autoTimer >= targetDuration && s.kickHard > 0.5) {
            const next = (this.currentScene % this.sceneCount) + 1  // 1→2→3→1
            this.currentScene = next
            this.switchScene(next)
            if (this.sceneController) this.sceneController.updateDisplay()  // update gui
            this.autoTimer = 0
        }
    } 
}