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

        this.sceneCount = 5
        this.transitioning = false
        this.auto = true         // Auto switching enabled
        this.minDuration = 6     // Duration when loud (fast cuts)
        this.maxDuration = 10    // Duration when quiet (slow cuts)
        this.volumeBoost = 3     // Amplifies volume (volumeAverageSmooth stays low)
        this.autoTimer = 0

        // One-shot scenes advance when their camera animation ends
        this.camera.onSceneEnd = () => {
            const next = (this.currentScene % this.sceneCount) + 1
            this.goToScene(next)
        }

        if(this.debug.active)
        {
            this.debugFolder = this.debug.gui.addFolder('MANAGER')
            this.sceneController = this.debugFolder.add(this, 'currentScene', { 'scene 1': 1, 'scene 2': 2, 'scene 3': 3, 'scene 4': 4, 'scene 5': 5 })
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
        if (this.transitioning) return                                      // Ignore re-entrant calls while a transition is playing
        this.transitioning = true
        this.currentScene = n
        this.autoTimer = 0                                                  // Reset the scene-duration timer on every change
        this.postProcessing.triggerTransition(() => {
            this.switchScene(n)                                             // Runs while the screen is closed
            if (this.sceneController) this.sceneController.updateDisplay()  // Keep the GUI in sync
            this.transitioning = false
        })
    }

    switchScene(sceneNumber)
    {
        // Instances from World
        const astronaut = this.world.astronaut
        const eye = this.world.eye
        const beam = this.world.beam
        const stars = this.world.stars
        const camera = this.camera

        switch(sceneNumber)
        {
            case 1:
                astronaut?.show() 
                astronaut?.setMode(1)
                eye?.hide()
                beam?.setMode(1)
                stars?.setMode(1)
                camera?.setMode(1)
                break

            case 2:
                astronaut?.show() 
                astronaut?.setMode(2)
                eye?.hide()
                beam?.setMode(2)
                stars?.setMode(2)
                camera?.setMode(2)
                break

            case 3:
                astronaut?.show()
                astronaut?.setMode(3)
                eye?.hide()
                beam?.setMode(3)
                stars?.setMode(3)
                camera?.setMode(3)
                break
            
            case 4:
                astronaut?.hide() 
                eye?.show()
                beam?.setMode(4)
                stars?.setMode(4)
                camera?.setMode(4)
                break
            case 5:
                astronaut?.show()
                astronaut?.setMode(5)
                eye?.hide()
                beam?.setMode(5)
                stars?.setMode(5)
                camera?.setMode(5)
                break
        }
    }

    update() {
        if (!this.auto) return
        if (!this.camera.loop) return   // One shot, handled by camera onComplete
        const s = this.sound

        // Volume amplified and clamped to 0..1
        const v = Math.min(s.volumeAverageSmooth * this.volumeBoost, 1)

        // Inverse mapping: high v → short duration, low v → long duration
        const targetDuration = this.maxDuration - v * (this.maxDuration - this.minDuration)

        this.autoTimer += this.time.delta * 0.001   // Seconds

        if (this.autoTimer >= targetDuration && this.sound.kickHard > 0.5) {
            const next = (this.currentScene % this.sceneCount) + 1
            this.goToScene(next)
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