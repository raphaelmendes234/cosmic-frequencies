import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import Experience from "./Experience";

export default class Camera 
{
    constructor()
    {
        this.experience = new Experience()
        this.sizes = this.experience.sizes
        this.scene = this.experience.scene
        this.canvas = this.experience.canvas
        this.debug = this.experience.debug
        this.sound = this.experience.sound

        this.baseFov = 35 // fov de base
        this.fovAmount = 60  

        this.setInstance()
        this.setOrbitControls()

        // Debug
        if(this.debug.active)
        {
            this.setDebug()
        }
    }

    setInstance()
    {
        this.instance = new THREE.PerspectiveCamera(
            35,
            this.sizes.width / this.sizes.height,
            0.1,
            1000
        )
        this.instance.position.set(0, 4, 8)
        this.scene.add(this.instance)
    }

    setOrbitControls()
    {
        this.controls = new OrbitControls(this.instance, this.canvas)
        this.controls.enableDamping = true
    }

    resize()
    {
        this.instance.aspect = this.sizes.width / this.sizes.height
        this.instance.updateProjectionMatrix()
    }

    setDebug()
    {
        this.debugFolder = this.debug.gui.addFolder('CAMERA')
        this.debugFolder.close()
        
        // Camera
        const positionFolder = this.debugFolder.addFolder('position')
        positionFolder.close()
        // On utilise .listen() pour que le slider suive les mouvements de la souris
        positionFolder.add(this.instance.position, 'x').min(-20).max(20).step(0.05).name('x').listen().onChange(() => {
            this.controls.update() // Force OrbitControls à réajuster ses angles internes
        })
        positionFolder.add(this.instance.position, 'y').min(-20).max(20).step(0.05).name('y').listen().onChange(() => {
            this.controls.update()
        })
        positionFolder.add(this.instance.position, 'z').min(-20).max(20).step(0.05).name('z').listen().onChange(() => {
            this.controls.update()
        })

        // Target
        const targetFolder = this.debugFolder.addFolder('target')
        targetFolder.close()
        targetFolder.add(this.controls.target, 'x').min(-10).max(10).step(0.05).name('target x').listen()
        targetFolder.add(this.controls.target, 'y').min(-10).max(10).step(0.05).name('target y').listen()
        targetFolder.add(this.controls.target, 'z').min(-10).max(10).step(0.05).name('target z').listen()

    }

    cutToShot(position, target)
    {
        this.instance.position.copy(position)
        this.controls.target.copy(target)
        this.controls.update() // Indispensable pour appliquer le changement de target
    }

    update()
    {
        this.controls.update()

        const s = this.sound
        this.instance.fov = this.baseFov + Math.pow(s.volumeAverageSmooth, 2.0) * this.fovAmount
        this.instance.updateProjectionMatrix()
    }
}