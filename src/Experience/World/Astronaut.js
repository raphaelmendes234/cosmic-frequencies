import * as THREE from 'three'
import Experience from '../Experience.js'

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
            envMapIntensity: 5.0,
            roughness: 0.3,
            metalness: 0.8,
        }
        
        this.setCubeCamera()
        this.setGroup()
        this.setModel()
        
        if (this.debug.active) {
            this.setDebug()
        }

        this.setAnimation()

    }
    
    setCubeCamera()
    {
        // Create cube camera target
        this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
            generateMipmaps: true,
            minFilter: THREE.LinearFilter
        })

        // Create CubeCamera
        this.cubeCamera = new THREE.CubeCamera(0.1, 1000, this.cubeRenderTarget)
        this.cubeCamera.children.forEach((cam) => cam.layers.set(1))   // reflect only the beams (layer 1)
        this.scene.add(this.cubeCamera)
    }

    setGroup()
    {
        this.group = new THREE.Group()
        this.scene.add(this.group)
    }

    setModel()
    {
        this.model = this.ressource.scene

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

        this.group.add(this.model)
        this.model.position.set(0, -1.6, 0)
    }

    setAnimation()
    {
        this.animation = {}
        this.animation.mixer = new THREE.AnimationMixer(this.model)
        
        this.animation.actions = {}

        this.animation.actions.falling = this.animation.mixer.clipAction(this.ressource.animations[0])
        this.animation.actions.floating = this.animation.mixer.clipAction(this.ressource.animations[1])
        this.animation.actions.idle = this.animation.mixer.clipAction(this.ressource.animations[2])
        this.animation.actions.moonWalk = this.animation.mixer.clipAction(this.ressource.animations[3])
        this.animation.actions.wave = this.animation.mixer.clipAction(this.ressource.animations[4])

        this.animation.actions.current = this.animation.actions.falling
        this.animation.actions.current.play()
        
        this.animation.play = (name) =>
        {
            const newAction = this.animation.actions[name]
            const oldAction = this.animation.actions.current

            oldAction.stop()
            newAction.reset()
            newAction.play()

            this.animation.actions.current = newAction
        }

        // Debug
        if(this.debug.active)
        {
            const debugObject = {
                playFalling: () => { this.animation.play('falling')},
                playFloating: () => { this.animation.play('floating')},
                playIdle: () => { this.animation.play('idle')},
                playWave: () => { this.animation.play('wave')},
                playMoonWalk: () => { this.animation.play('moonWalk')}
            }
            this.debugFolder.add(debugObject, 'playFalling')
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

    setMode(name)
    {
        if (!this.group || !this.model) return
        
        this.mode = name
        this.hide()

        if (this.mode === "front") 
        {
            this.show()
            this.group.scale.set(0.5, 0.5, 0.5)
            this.group.position.set(0, 0, 0)
            this.group.rotation.set(0, 0, 0)
            this.animation.play('falling')
        } 
        else if (this.mode === "side") 
        {
            this.show()
            this.group.scale.set(1, 1, 1)
            this.group.position.set(0, -0.5, 0)
            this.group.rotation.set(-Math.PI * 0.5, 0, -Math.PI * 0.5)
            this.animation.play('falling')
        } 
        else if (this.mode === "closeup") 
        {
            this.show()
            this.group.scale.set(1, 1, 1)
            this.group.position.set(0, 0, 0)
            this.group.rotation.set(-Math.PI * 0.2, Math.PI * 0.1, 0)
            this.animation.play('idle')
        }
        else if(this.mode === "far") 
        {
            this.show()
            this.group.scale.set(0.3, 0.3, 0.3)
            this.group.position.set(0, 0, 0)
            this.group.rotation.set(0, 0, 0)
            this.animation.play('falling')
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
        if (!this.model || !this.model.visible) return
        
        const deltaTime = this.time.delta
        const elapsedTime = this.time.elapsed

        // Group rotation (front & far share the same spin)
        if (this.mode === 'front' || this.mode === 'far') {
            this.group.rotation.x += deltaTime * 0.001 * 0.05
            this.group.rotation.y += deltaTime * 0.001 * 0.5
            this.group.rotation.z += deltaTime * 0.001 * 0.5
        }

        // Cube camera positioning
        this.cubeCamera.position.copy(this.model.position)
        if (this.mode === "front") {
            this.cubeCamera.position.y += 4
            
        } 
        else if (this.mode === "side") {
            this.cubeCamera.position.x += 2
            this.cubeCamera.position.y += 12 
            this.cubeCamera.position.z -= 2 
        }
            
        // Refresh reflection ~25 times/sec (framerate-independent)
        this.cubeAccum = (this.cubeAccum || 0) + this.time.delta
        if (this.cubeAccum >= 40) {   // ms between refreshes
            this.cubeAccum = 0
            this.model.visible = false
            this.cubeCamera.update(this.renderer.instance, this.scene)
            this.model.visible = true
        }

        this.animation.mixer.update(this.time.delta * 0.001)
    }
}