import * as THREE from 'three'

import Experience from '../Experience'

export default class Eye
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
        this.ressource = this.ressources.items.anatomicalEyeball

        this.materialParams = {
            envMapIntensity: 4.0,
            roughness: 0.1,
            metalness: 0.75,
        }

        this.setCubeCamera()
        this.setModel()

        if (this.debug.active) {
            this.setDebug()
        }

        this.setAnimation()
    }

    setModel()
    {
        this.model = this.ressource.scene
        this.model.position.set(-1.2, -2.5 , 3.5)
        this.model.rotation.set(0, Math.PI * 0.25 , 0)
        this.model.scale.set(0.3, 0.3, 0.3)
        this.scene.add(this.model)

        this.model.traverse((child) => 
        {
            if(child instanceof THREE.Mesh)
            {
                child.castShadow = true

                this.visiereMesh = child;
    
                const mat = child.material;
                mat.envMap = this.cubeRenderTarget.texture;
                mat.envMapIntensity = this.materialParams.envMapIntensity
                mat.roughness = this.materialParams.roughness
                mat.metalness = this.materialParams.metalness
    
                mat.needsUpdate = true;
        }
        })
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

    setAnimation()
    {
        this.animation = {}
        this.animation.mixer = new THREE.AnimationMixer(this.model)

        this.animation.actions = {}
        
        this.animation.actions.idle = this.animation.mixer.clipAction(this.ressource.animations[0])

        this.animation.actions.current = this.animation.actions.idle
        this.animation.actions.current.play()
    }

    setDebug()
    {
        this.debugFolder = this.debug.gui.addFolder("EYE")
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