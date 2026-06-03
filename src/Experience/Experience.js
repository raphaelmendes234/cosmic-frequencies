import * as THREE from 'three'

import Sizes from "./Utils/Sizes.js"
import Time from "./Utils/Time.js"
import Camera from './Camera.js'
import Renderer from './Renderer.js'
import World from './World/World.js'
import Debug from './Utils/Debug.js'
import Ressources from './Utils/Ressources.js'
import PostProcessing from './PostProcessing.js'
import Sound from './Utils/Sound.js'

import sources from './sources.js'

let instance = null

export default class Experience 
{
    constructor(canvas)
    {
        if(instance)
        {
            return instance
        }

        instance = this

        // Global acces
        window.experience = this

        // Options
        this.canvas = canvas

        // Set up
        this.debug = new Debug()
        this.sizes = new Sizes()
        this.time = new Time()
        this.scene = new THREE.Scene()
        this.sound = new Sound()      
        this.ressources = new Ressources(sources)
        this.camera = new Camera()
        this.renderer = new Renderer()
        this.world = new World()
        this.postProcessing = new PostProcessing()

        // Sizes resize event
        this.sizes.on('resize', () => {
            this.resize()
        })

        // Time tick event
        this.time.on('tick', () => {
            this.update()
        })
    }

    resize()
    {
        this.camera.resize()
        this.renderer.resize()
        // this.world.objects.resize()
        this.postProcessing.resize()
    }

    update()
    {
        this.camera.update()
        this.world.update()

        if (this.postProcessing) {
            this.postProcessing.update()
        } else {
            this.renderer.update()
        }
    }

    destroy()
    {
        // Stop listenning to the events
        this.sizes.off('resize')
        this.time.off('tick')

        // Traverse the whole scene
        // Meshes (geo, mat, values...)
        this.scene.traverse((child) => 
        {
            if(child instanceof THREE.Mesh)
            {
                child.geometry.dispose()

                for(const key in child)
                {
                    const value = child.material[key]

                    if(value && typeof value.dispose === 'function')
                    {
                        value.dispose()
                    }
                }
            }
        })

        // OrbitControls
        this.camera.controls.dispose()
        
        // Renderer
        this.renderer.instance.dispose()

        // Post-processing
        this.postProcessing.dispose()

        // Lil-gui
        if (this.debug.active) 
        {
            this.debug.gui.dispose()    
        }
    }
}