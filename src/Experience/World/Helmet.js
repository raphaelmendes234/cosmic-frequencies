import * as THREE from 'three'

import Experience from '../Experience'

export default class Helmet
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
        this.ressource = this.ressources.items.helmetModel

        this.materialParams = {
            envMapIntensity: 3.0,
            roughness: 0.3,
            metalness: 1.0
        }

        this.setCubeCamera()
        this.setModel()

        if (this.debug.active) {
            this.setDebug()
        }
    }

    setModel()
    {
        this.model = this.ressource.scene
        this.model.scale.set(2, 2, 2)
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

    setCubeCamera()
    {
        // Créer la cible de rendu cubique (résolution de 256 ou 512 est souvent suffisante)
        this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
            generateMipmaps: true,
            minFilter: THREE.LinearMipmapLinearFilter
        })

        // Créer la CubeCamera (near, far, renderTarget)
        this.cubeCamera = new THREE.CubeCamera(0.1, 1000, this.cubeRenderTarget)
        this.scene.add(this.cubeCamera)
    }

    setDebug()
    {
        this.debugFolder = this.debug.gui.addFolder("HELMET")
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
            this.model.visible = false
            this.cubeCamera.update(this.renderer.instance, this.scene)
            this.model.visible = true
        }
    }
}