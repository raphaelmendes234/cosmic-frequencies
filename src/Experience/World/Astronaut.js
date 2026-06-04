import * as THREE from 'three'

import Experience from '../Experience'

export default class Astronaut
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.ressources = this.experience.ressources
        this.time = this.experience.time
        this.debug = this.experience.debug
        this.renderer = this.experience.renderer

        // Setup
        this.ressource = this.ressources.items.astronautModel
        
        this.materialParams = {
            envMapIntensity: 3.0,
            roughness: 0.3,
            metalness: 1.0,
        }
        
        this.setCubeCamera()
        this.setModel()
        
        if (this.debug.active) {
            this.setDebug()
        }

        this.setAnimation()

    }
    
    setCubeCamera()
    {
        // Créer la cible de rendu cubique (résolution de 256 ou 512 est souvent suffisante)
        this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
            generateMipmaps: true,
            minFilter: THREE.LinearFilter
        })

        // Créer la CubeCamera (near, far, renderTarget)
        this.cubeCamera = new THREE.CubeCamera(0.1, 1000, this.cubeRenderTarget)
        this.scene.add(this.cubeCamera)
    }

    setModel()
    {
        this.model = this.ressource.scene
        // this.model.position.set(0, -5, 0)
        // this.model.scale.set(1.5, 1.5, 1.5)
        this.scene.add(this.model)

        this.model.traverse((child) => 
        {
            if(child instanceof THREE.Mesh)
            {
                child.castShadow = true
    
                const mat = child.material;
                mat.envMap = this.cubeRenderTarget.texture;
                mat.envMapIntensity = this.materialParams.envMapIntensity
                mat.roughness = this.materialParams.roughness
                mat.metalness = this.materialParams.metalness
    
                mat.needsUpdate = true;
        }
        })
    }

    setAnimation()
    {
        this.animation = {}
        this.animation.mixer = new THREE.AnimationMixer(this.model)
        
        this.animation.actions = {}
        
        this.animation.actions.floating = this.animation.mixer.clipAction(this.ressource.animations[0])
        this.animation.actions.idle = this.animation.mixer.clipAction(this.ressource.animations[1])
        this.animation.actions.moonWalk = this.animation.mixer.clipAction(this.ressource.animations[2])
        this.animation.actions.wave = this.animation.mixer.clipAction(this.ressource.animations[3])

        this.animation.actions.current = this.animation.actions.floating
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
                playFloating: () => { this.animation.play('floating')},
                playIdle: () => { this.animation.play('idle')},
                playWave: () => { this.animation.play('wave')},
                playMoonWalk: () => { this.animation.play('moonWalk')}
            }
            this.debugFolder.add(debugObject, 'playFloating')
            this.debugFolder.add(debugObject, 'playIdle')
            this.debugFolder.add(debugObject, 'playWave')
            this.debugFolder.add(debugObject, 'playMoonWalk')
        }
    }

    setDebug()
    {
        this.debugFolder = this.debug.gui.addFolder("ASTRONAUT")
        this.debugFolder.close()

        this.debugFolder.add(this.materialParams, "envMapIntensity").min(0).max(5).step(0.01).onChange((value) => {
                this.model.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.material.envMapIntensity = value
                        child.material.needsUpdate = true
                    }
                })
            })

        this.debugFolder.add(this.materialParams, "roughness").min(0).max(1).step(0.01).onChange((value) => {
                this.model.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.material.roughness = value
                        child.material.needsUpdate = true
                    }
                })
            })

        this.debugFolder.add(this.materialParams, "metalness").min(0).max(1).step(0.01).onChange((value) => {
                this.model.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.material.metalness = value
                        child.material.needsUpdate = true
                    }
                })
            })
    }

    setMode(modeNumber)
    {
        if (!this.model && !this.model.visible) return
        
        this.mode = modeNumber

        if (this.mode === 1) {
            this.model.scale.set(1.75,1.75,1.75)
            this.model.position.set(0, -6, 0)
        } 
        else if (this.mode === 2) {
            this.model.scale.set(3,3,3)
            this.model.position.set(-2, -10.7, 1)
        } 
        else if (this.mode === 3) {
           console.log("astronaut on scene 3")
        }
    }

    show()
    {
        if(this.model) this.model.visible = true
    }

    hide()
    {
        if(this.model) this.model.visible = false
    }

    update()
    {
        if (this.model && this.model.visible) {
            this.cubeCamera.position.copy(this.model.position)
            if (this.mode === 1) {
                this.cubeCamera.position.y += 6 
            } else if (this.mode === 2) {
                this.cubeCamera.position.y += 12 
                this.cubeCamera.position.x += 2
                this.cubeCamera.position.z -= 2 
            }
            this.cubeFrame = (this.cubeFrame || 0) + 1
            if (this.cubeFrame % 4 === 0) {          // refresh reflection 1 frame in 4
                this.model.visible = false
                this.cubeCamera.update(this.renderer.instance, this.scene)
                this.model.visible = true
            }

            this.animation.mixer.update(this.time.delta * 0.001)
        }
    }
}