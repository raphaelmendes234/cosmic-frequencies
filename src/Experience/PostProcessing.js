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
        this.time = this.experience.time
        this.camera = this.experience.camera.instance
        this.renderer = this.experience.renderer.instance
        this.debug = this.experience.debug
        this.sound = this.experience.sound

        this.aberrationStrength = 0.05

        // Set up
        this.setRenderTarget()
        this.setEffectComposer()
        this.setRenderPass()

        // Passes
        this.setUnrealBloomPass()
        this.setCRTPass()

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

    setCRTPass() {
        const CRTPass = {
            uniforms: {
                tDiffuse: { value: null },
                uCurvature: { value: 4.2 },
                uBorder: { value: 0.05 },
                uAberration: { value: 0.05 },
                uGrain: { value: 0.0 },
                uTime: { value: 0 } 
            },
            vertexShader: `
                varying vec2 vUv;

                void main(){
                    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
                    vUv = uv;
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float uCurvature;
                uniform float uBorder;
                uniform float uAberration;
                uniform float uGrain;
                uniform float uTime;
                varying vec2 vUv;

                float rand(vec2 co){
                    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
                }

                float hash12(vec2 p){
                    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
                    p3 += dot(p3, p3.yzx + 33.33);
                    return fract((p3.x + p3.y) * p3.z);
                }

                vec2 curve(vec2 uv){
                    uv = uv * 2.0 - 1.0;
                    vec2 offset = abs(uv.yx) / uCurvature;
                    uv = uv + uv * offset * offset;   // bombe l'image (tube)
                    return uv * 0.5 + 0.5;
                }

                void main(){
                    vec2 uv = curve(vUv);

                    // aberration chromatique radiale (plus forte vers les bords)
                    vec2 ca = (uv - 0.5) * uAberration;
                    float r = texture2D(tDiffuse, uv - ca).r;
                    float g = texture2D(tDiffuse, uv).g;
                    float b = texture2D(tDiffuse, uv + ca).b;
                    vec4 color = vec4(r, g, b, 1.0);

                    // grain / static (animé, en espace écran)
                    float noise = hash12(gl_FragCoord.xy + fract(uTime) * 100.0);
                    color.rgb += (noise - 0.5) * uGrain;

                    // cadre noir arrondi (noircit aussi tout ce qui sort de l'écran courbé)
                    vec2 edge = smoothstep(0.0, uBorder, uv) * (1.0 - smoothstep(1.0 - uBorder, 1.0, uv));
                    color.rgb *= edge.x * edge.y;

                    gl_FragColor = color;
                }
            `,
        }

        this.crtPass = new ShaderPass(CRTPass)
        this.crtPass.enabled = true
        this.effectComposer.addPass(this.crtPass)

        if (this.debug.active) {
            const f = this.debug.gui.addFolder("CRT")
            f.add(this.crtPass.material.uniforms.uCurvature, "value").min(2.5).max(10).step(0.1).name("courbure")
            f.add(this.crtPass.material.uniforms.uBorder, "value").min(0).max(0.3).step(0.005).name("bordure")
            f.add(this, "aberrationStrength").min(0).max(0.1).step(0.001).name("aberration")
            f.add(this.crtPass.material.uniforms.uGrain, "value").min(0).max(10).step(0.005).name("grain")
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
            console.log("Using SMAA")
        }
    }

    resize() {
        this.effectComposer.setSize(this.sizes.width, this.sizes.height)
        this.effectComposer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    }

    update() {
        this.crtPass.material.uniforms.uAberration.value = this.sound.kickHard * this.aberrationStrength
        this.crtPass.material.uniforms.uTime.value = this.time.elapsed * 0.001

        this.effectComposer.render()
    }

    dispose() {
        this.effectComposer.dispose()
        this.unrealBloomPass.dispose()
        if (this.smaaPass) {
            this.smaaPass.dispose()
        }
    }
}