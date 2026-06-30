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

        this.order = ['front', 'side', 'closeup', 'eye', 'far']
        
        this.currentScene = this.order[0]
        this.transitioning = false
        this.auto = true                // Auto switching enabled
        this.minDuration = 4            // Duration when loud (fast cuts)
        this.maxDuration = 8           // Duration when quiet (slow cuts)
        this.volumeBoost = 3            // Amplifies volume (volumeAverageSmooth stays low)
        this.autoTimer = 0

        // One-shot scenes advance when their camera animation ends
        this.camera.onSceneEnd = () => {
            this.goToScene(this.nextScene())
        }

        if(this.debug.active)
        {
            this.debugFolder = this.debug.gui.addFolder('MANAGER')

            const sceneOptions = {}
            this.order.forEach((name) => { sceneOptions[name] = name })
            this.sceneController = this.debugFolder.add(this, 'currentScene', sceneOptions)
                .name('Change scene')
                .onChange(() => { this.goToScene(this.currentScene) })

            this.debugFolder.add(this, 'auto').name('auto switch')
            this.debugFolder.add(this, 'minDuration').min(1).max(20).step(1).name('min duration (high)')
            this.debugFolder.add(this, 'maxDuration').min(1).max(30).step(1).name('max duration (weak)')
            this.debugFolder.add(this, 'volumeBoost').min(1).max(10).step(0.1).name('volume sensibility')
        }
    }

    // Next scene name in the order (cyclic)
    nextScene()
    {
        const i = this.order.indexOf(this.currentScene)
        return this.order[(i + 1) % this.order.length]
    }

    // Switch at the closed point of the transition (cut hidden behind the black screen)
    goToScene(name)
    {   
        if (this.transitioning) return                                      // Ignore re-entrant calls while a transition is playing
        this.transitioning = true
        this.currentScene = name
        this.autoTimer = 0                                                  // Reset the scene-duration timer on every change
        this.postProcessing.triggerTransition(() => {
            this.switchScene(name)                                          // Runs while the screen is closed
            if (this.sceneController) this.sceneController.updateDisplay()  // Keep the GUI in sync
            this.transitioning = false
        })

        // check if scene "far" for bloom boost
        this.postProcessing.setBloom(this.currentScene)
    }

    // Trivial fan-out: every object configures itself from the scene name
    switchScene(name)
    {
        this.world.astronaut?.setMode(name)
        this.world.eye?.setMode(name)
        this.world.beam?.setMode(name)
        this.world.stars?.setMode(name)
        this.camera?.setMode(name)
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
            this.goToScene(this.nextScene())
        }
    } 

    reset()
    {
        this.currentScene = this.order[0]
        this.autoTimer = 0
        this.switchScene(this.currentScene)
        if (this.sceneController) this.sceneController.updateDisplay()
    }
}