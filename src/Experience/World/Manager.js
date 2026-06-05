import * as THREE from 'three'
import Experience from '../Experience.js'

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
        this.postProcessing = this.experience.postProcessing

        this.currentScene = 1

        this.sceneCount = 3
        this.auto = true         // Auto switching enabled
        this.minDuration = 6     // Duration when loud (fast cuts)
        this.maxDuration = 12    // Duration when quiet (slow cuts)
        this.volumeBoost = 3     // Amplifies volume (volumeAverageSmooth stays low)
        this.autoTimer = 0

        if(this.debug.active)
        {
            this.debugFolder = this.debug.gui.addFolder('MANAGER')
            this.sceneController = this.debugFolder.add(this, 'currentScene', { 'scene 1': 1, 'scene 2': 2, 'scene 3': 3 })
                .name('Change scene')
                .onChange(() => { this.goToScene(parseInt(this.currentScene)) })

            this.debugFolder.add(this, 'auto').name('auto switch')
            this.debugFolder.add(this, 'minDuration').min(1).max(20).step(1).name('min duration (high)')
            this.debugFolder.add(this, 'maxDuration').min(1).max(30).step(1).name('max duration (weak)')
            this.debugFolder.add(this, 'volumeBoost').min(1).max(10).step(0.1).name('volume sensibility')
        }
    }

    // Switch at the closed point of the transition (cut hidden behind the black screen)
    goToScene(n)
    {
        this.currentScene = n
        this.postProcessing.triggerTransition(() => {
            this.switchScene(n)                                             // Runs while the screen is closed
            if (this.sceneController) this.sceneController.updateDisplay()  // Keep the GUI in sync
        })
    }

    switchScene(sceneNumber)
    {
        // Instances from World
        const astronaut = this.world.astronaut
        const eye = this.world.eye
        const beam = this.world.beam
        const stars = this.world.stars

        // Center target for the camera
        const centerTarget = new THREE.Vector3(0, 0, 0)

        switch(sceneNumber)
        {
            case 1:
                if(astronaut) { 
                    astronaut.show() 
                    astronaut.setMode(1)
                }
                if(eye) eye.hide()
                if(beam) beam.setMode(1)
                if(stars) stars.setMode(1)
                this.camera.cutToShot(new THREE.Vector3(0, 0, 16), centerTarget)
                break

            case 2:
                if(astronaut) {
                    astronaut.show() 
                    astronaut.setMode(2)
                }
                if(eye) eye.hide()
                if(beam) beam.setMode(2)
                if(stars) stars.setMode(2)
                this.camera.cutToShot(new THREE.Vector3(-3.5, 0.6, 4.3), new THREE.Vector3(5.8, -0.7, -2))
                break

            case 3:
                if(astronaut) astronaut.hide()
                if(eye) eye.show()
                if(beam) beam.setMode(3)
                if(stars) stars.setMode(3)
                this.camera.cutToShot(new THREE.Vector3(0, 0, 8), centerTarget)
                break
        }
    }

    update() {
        if (!this.auto) return
        const s = this.sound

        // Volume amplified and clamped to 0..1
        const v = Math.min(s.volumeAverageSmooth * this.volumeBoost, 1)

        // Inverse mapping: high v → short duration, low v → long duration
        const targetDuration = this.maxDuration - v * (this.maxDuration - this.minDuration)

        this.autoTimer += this.time.delta * 0.001   // Seconds

        if (this.autoTimer >= targetDuration && this.sound.kickHard > 0.5) {
            const next = (this.currentScene % this.sceneCount) + 1
            this.goToScene(next)
            this.autoTimer = 0
        }
    } 

    reset()
    {
        this.currentScene = 1
        this.autoTimer = 0
        this.switchScene(1)
        if (this.sceneController) this.sceneController.updateDisplay()
    }
}