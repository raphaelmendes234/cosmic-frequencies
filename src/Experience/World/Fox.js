import * as THREE from 'three'

import Experience from '../Experience'

export default class Fox
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.ressources = this.experience.ressources
        this.time = this.experience.time
        this.debug = this.experience.debug

        // Debug
        if(this.debug.active)
        {
            this.debugFolder = this.debug.gui.addFolder('FOX')
            this.debugFolder.close()
        }

        // Setup
        this.ressource = this.ressources.items.foxModel

        this.setModel()
        this.setAnimation()
    }

    setModel()
    {
        this.model = this.ressource.scene
        this.model.scale.set(0.02, 0.02, 0.02)
        this.scene.add(this.model)

        this.model.traverse((child) => 
        {
            if(child instanceof THREE.Mesh)
            {
                child.castShadow = true
            }
        })
    }

    setAnimation()
    {
        this.animation = {}
        this.animation.mixer = new THREE.AnimationMixer(this.model)

        this.animation.actions = {}

        this.animation.actions.idle = this.animation.mixer.clipAction(this.ressource.animations[0])
        this.animation.actions.walking = this.animation.mixer.clipAction(this.ressource.animations[1])
        this.animation.actions.running = this.animation.mixer.clipAction(this.ressource.animations[2])

        this.animation.actions.current = this.animation.actions.idle
        this.animation.actions.current.play()

        this.animation.play = (name) =>
        {
            const newAction = this.animation.actions[name]
            const oldAction = this.animation.actions.current

            newAction.reset()
            newAction.play()
            newAction.crossFadeFrom(oldAction, 1)

            this.animation.actions.current = newAction
        }

        // Debug
        if(this.debug.active)
        {
            const debugObject = {
                playIdle: () => { this.animation.play('idle')},
                playWalking: () => { this.animation.play('walking')},
                playRunning: () => { this.animation.play('running')}
            }
            this.debugFolder.add(debugObject, 'playIdle')
            this.debugFolder.add(debugObject, 'playWalking')
            this.debugFolder.add(debugObject, 'playRunning')
        }
    }

    update()
    {
        this.animation.mixer.update(this.time.delta * 0.001)
    }
}