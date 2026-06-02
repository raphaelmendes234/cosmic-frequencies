import * as THREE from 'three'

import Experience from "./Experience";

// Effect composer
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
// Passes
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

// Shaders
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js'

export default class PostProcessing
{
    constructor()
    {
        this.experience = new Experience()
        this.sizes = this.experience.sizes
        this.scene = this.experience.scene
        this.camera = this.experience.camera.instance
        this.renderer = this.experience.renderer.instance
        this.debug = this.experience.debug

        // Set up
        this.setRenderTarget()
        this.setEffectComposer()
        this.setRenderPass()

        // Passes
        this.setUnrealBloomPass()

        // Corrections passes
        this.setGammaCorrectionPass()
        this.setSMAAPass()
    }

    setRenderTarget() {
        this.renderTarget = new THREE.WebGLRenderTarget(
            800,
            600,
            {
                samples: this.renderer.getPixelRatio() === 1 ? 2 : 0
            }
        )
    }

    setEffectComposer() {
        this.effectComposer = new EffectComposer(this.renderer, this.renderTarget)
        this.effectComposer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.effectComposer.setSize(this.sizes.width, this.sizes.height)
    }

    setRenderPass() {
        this.renderPass = new RenderPass(this.scene, this.camera)
        this.effectComposer.addPass(this.renderPass)
    }

    setUnrealBloomPass() {
        this.unrealBloomPass = new UnrealBloomPass()
        this.unrealBloomPass.strength = 0.2
        this.unrealBloomPass.radius = 2
        this.unrealBloomPass.threshold = 0.5
        this.unrealBloomPass.enabled = true
        this.effectComposer.addPass(this.unrealBloomPass)

        if (this.debug.active) {
            this.debugFolder = this.debug.gui.addFolder("POST PROCESSING")
            this.debugFolder.close()
            this.debugFolder.add(this.unrealBloomPass, "strength").min(0).max(2).step(0.001)
            this.debugFolder.add(this.unrealBloomPass, "radius").min(0).max(2).step(0.001)
            this.debugFolder.add(this.unrealBloomPass, "threshold").min(0).max(1).step(0.001)
        }
    }

    setGammaCorrectionPass() {
        this.gammaCorrectionPass = new ShaderPass(GammaCorrectionShader)
        this.gammaCorrectionPass.enabled = true
        this.effectComposer.addPass(this.gammaCorrectionPass)
    }

    setSMAAPass() {
        if (this.renderer.getPixelRatio() === 1 && !this.renderer.capabilities.isWebGL2) {
            this.smaaPass = new SMAAPass()
            this.effectComposer.addPass(this.smaaPass)
            console.lpog("Using SMAA")
        }
    }

    update() {
        this.effectComposer.render()
    }
}