import * as THREE from 'three'
import Experience from '../Experience.js'

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
        this.sound = this.experience.sound

        // Setup
        this.ressource = this.ressources.items.eyeModel

        this.materialParams = {
            face: {
                envMapIntensity: 4.0,
                roughness: 0.2,
                metalness: 0.82,
            }, 
            eye: {
                envMapIntensity: 5.0,
                roughness: 0.0,
                metalness: 0.9,
            }
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
                const mat = child.material;

                if (child.name === "Face") {
                    this.faceMesh = child
                    mat.envMap = this.cubeRenderTarget.texture;
                    mat.envMapIntensity = this.materialParams.face.envMapIntensity
                    mat.roughness = this.materialParams.face.roughness
                    mat.metalness = this.materialParams.face.metalness
                } 
                if (child.name === "Eye") {
                    this.eyeMesh = child
                    mat.envMap = this.cubeRenderTarget.texture;
                    mat.envMapIntensity = this.materialParams.eye.envMapIntensity
                    mat.roughness = this.materialParams.eye.roughness
                    mat.metalness = this.materialParams.eye.metalness
                }

                mat.needsUpdate = true;
        }
        })
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

        const eyeFolder = this.debugFolder.addFolder("eyeball")
        eyeFolder.add(this.materialParams.eye, "envMapIntensity").min(0).max(5).step(0.01).onChange((value) => {
            this.eyeMesh.material.envMapIntensity = value
            this.eyeMesh.material.needsUpdate = true
        })
        eyeFolder.add(this.materialParams.eye, "roughness").min(0).max(1).step(0.01).onChange((value) => {
            this.eyeMesh.material.roughness = value
            this.eyeMesh.material.needsUpdate = true
        })
        eyeFolder.add(this.materialParams.eye, "metalness").min(0).max(1).step(0.01).onChange((value) => {
            this.eyeMesh.material.metalness = value
            this.eyeMesh.material.needsUpdate = true
        })

        const faceFolder = this.debugFolder.addFolder("face")
        faceFolder.add(this.materialParams.face, "envMapIntensity").min(0).max(5).step(0.01).onChange((value) => {
            this.faceMesh.material.envMapIntensity = value
            this.faceMesh.material.needsUpdate = true
        })
        faceFolder.add(this.materialParams.face, "roughness").min(0).max(1).step(0.01).onChange((value) => {
            this.faceMesh.material.roughness = value
            this.faceMesh.material.needsUpdate = true
        })
        faceFolder.add(this.materialParams.face, "metalness").min(0).max(1).step(0.01).onChange((value) => {
            this.faceMesh.material.metalness = value
            this.faceMesh.material.needsUpdate = true
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
            
            // Refresh reflection every 4 frames
            this.cubeFrame = (this.cubeFrame || 0) + 1
            if (this.cubeFrame % 4 === 0) {
                this.model.visible = false
                this.cubeCamera.update(this.renderer.instance, this.scene)
                this.model.visible = true
            }

            this.animation.mixer.update(this.time.delta * 0.001 * Math.min(Math.pow(this.sound.volumeAverageSmooth, 3.0) * 25, 2))
        }
    }
}