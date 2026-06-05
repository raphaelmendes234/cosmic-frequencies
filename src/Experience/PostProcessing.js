import * as THREE from 'three'

import Experience from "./Experience.js";

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

        // CRT pass
        this.aberrationStrength = 0.05
        this.transition = 1             // 1 = screen closed (starts cut off during loading)
        this.phase = 'closed'           // Current animation state
        this.t = 0                      // Progress of the current transition (0→1)
        this.transitionDuration = 0.2   // Duration of a full cut (s)
        this.onPeak = null              // Callback run when the screen is closed (to switch)
        this.peakFired = false          // Prevents calling onPeak more than once

        // Open the screen once assets are loaded
        this.experience.ressources.on('loaded', () => { this.phase = 'opening'; this.t = 0 })

        // Black and white pass
        this.bw = 0
        this.bwTimer = 0
        this.bwHold = 0             // Remaining B&W display time
        this.bwDuration = 0.6       // Flash duration (s)
        this.bwBaseInterval = 4     // Interval when sound is low (s)
        this.bwAmount = 40          // Volume-based acceleration (raise to blink more on loud parts)

        this.contrast = 1.1

        // Set up
        this.setRenderTarget()
        this.setEffectComposer()
        this.setRenderPass()

        // Passes
        this.setUnrealBloomPass()
        this.setCRTPass()
        this.setBlackWhitePass()

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

    triggerTransition(onPeak)
    {
        // Start a full cut: close then reopen
        this.phase = 'pulsing'
        this.t = 0
        this.onPeak = onPeak       // Called when closed (to switch the scene)
        this.peakFired = false
    }

    setCRTPass() {
        const CRTPass = {
            uniforms: {
                tDiffuse: { value: null },
                uCurvature: { value: 4.2 },
                uBorder: { value: 0.05 },
                uAberration: { value: 0.05 },
                uGrain: { value: 0.0 },
                uTime: { value: 0 },
                uTransition: { value: 1 }
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
                uniform float uTransition;
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
                    uv = uv + uv * offset * offset;         // Bulge the image (tube)
                    return uv * 0.5 + 0.5;
                }

                void main(){
                    vec2 uv = curve(vUv);

                    // CRT cut: compress the image into a horizontal band
                    // openY = visible screen height (1 = open, 0 = closed to a line)
                    float openY = 1.0 - uTransition;

                    // Stretch the visible band toward the real texture coordinate:
                    // when openY is small, only the center (y~0.5) falls in [0,1]
                    float y = (uv.y - 0.5) / max(openY, 0.0001) + 0.5;
                    vec2 tuv = vec2(uv.x, y);

                    // Chromatic aberration: sample R and B shifted toward the edges
                    vec2 ca = (tuv - 0.5) * uAberration;
                    float r = texture2D(tDiffuse, tuv - ca).r;
                    float g = texture2D(tDiffuse, tuv).g;
                    float b = texture2D(tDiffuse, tuv + ca).b;
                    vec4 color = vec4(r, g, b, 1.0);

                    // Grain: per-pixel white noise, animated by uTime
                    float noise = hash12(gl_FragCoord.xy + fract(uTime) * 100.0);
                    color.rgb += (noise - 0.5) * uGrain;

                    // Anything outside the visible band turns black
                    if (y < 0.0 || y > 1.0) color.rgb = vec3(0.0);

                    // Glow: bright center line, stronger as the screen closes
                    float glow = smoothstep(openY * 0.5, 0.0, abs(uv.y - 0.5));
                    color.rgb += glow * uTransition * 0.4;

                    // Rounded black TV frame
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
            f.close()
            f.add(this.crtPass.material.uniforms.uCurvature, "value").min(2.5).max(10).step(0.1).name("curvature")
            f.add(this.crtPass.material.uniforms.uBorder, "value").min(0).max(0.3).step(0.005).name("border")
            f.add(this, "aberrationStrength").min(0).max(0.1).step(0.001).name("aberration")
            f.add(this.crtPass.material.uniforms.uGrain, "value").min(0).max(10).step(0.005).name("grain")
        }
    }

    setBlackWhitePass() {
        const BlackWhitePass = {
            uniforms: {
                tDiffuse: { value: null },
                uBW: { value: 0 },                      // 0 = normal, 1 = black & white
                uContrast: { value: this.contrast }
            },
            vertexShader: `
                varying vec2 vUv;
                void main(){
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float uBW;
                uniform float uContrast;
                varying vec2 vUv;
                void main(){
                    vec4 c = texture2D(tDiffuse, vUv);
                    float gray = dot(c.rgb, vec3(0.299, 0.587, 0.114));         // Luminance
                    gray = clamp((gray - 0.5) * uContrast + 0.5, 0.0, 1.0);     // Punch: push away from mid-gray
                    c.rgb = mix(c.rgb, vec3(gray), uBW);
                    gl_FragColor = c;
                }
            `,
        }
        this.bwPass = new ShaderPass(BlackWhitePass)
        this.bwPass.enabled = true
        this.effectComposer.addPass(this.bwPass)
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
        const dt = this.time.delta * 0.001

        /**
         * CRT pass
         */
        if (this.phase === 'closed') {
            this.transition = 1                                 // Stays closed while loading
        } else if (this.phase === 'opening') {                  // Loaded: opening 1 → 0
            this.t += dt / this.transitionDuration
            this.transition = 1 - Math.min(this.t, 1)
            if (this.t >= 1) this.phase = 'idle'
        } else if (this.phase === 'pulsing') {                  // Shot change: close (0→1) then open (1→0)
            this.t += dt / this.transitionDuration
            const x = Math.min(this.t, 1)
            this.transition = 1 - Math.abs(x * 2 - 1)           // Triangle curve: peak at midpoint
            
            // At midpoint (screen closed), trigger the switch once
            if (!this.peakFired && x >= 0.5) { this.peakFired = true; if (this.onPeak) this.onPeak() }
            if (this.t >= 1) this.phase = 'idle'
        } else {
            this.transition = 0                                 // Idle: normal screen
        }
        this.crtPass.material.uniforms.uTransition.value = this.transition
        this.crtPass.material.uniforms.uAberration.value = this.sound.kickHard * this.aberrationStrength
        this.crtPass.material.uniforms.uTime.value = this.time.elapsed * 0.001

        /**
         *  Black and white
         */
        const boost = Math.pow(this.sound.volumeAverageSmooth, 2.0) * this.bwAmount
        const bwInterval = Math.max(this.bwBaseInterval / (1 + boost), 0.1)

        if (this.bwHold > 0) {
            this.bwHold -= dt
            this.bw = this.bwHold > 0 ? 1 : 0
        } else {
            this.bwTimer += dt
            if (this.bwTimer >= bwInterval) {
                this.bwHold = Math.max(this.bwDuration / (1 + boost), 0.1)   // Never below 0.1s
                this.bwTimer = 0
            }
        }

        this.bwPass.material.uniforms.uBW.value = this.bw

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