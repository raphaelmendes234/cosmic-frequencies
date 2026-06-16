import * as THREE from 'three'
import { gsap } from 'gsap' 
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import Experience from "./Experience.js";

export default class Camera 
{
    constructor()
    {
        this.experience = new Experience()
        this.sizes = this.experience.sizes
        this.scene = this.experience.scene
        this.time = this.experience.time
        this.canvas = this.experience.canvas
        this.debug = this.experience.debug
        this.sound = this.experience.sound

        this.baseFov = 35                           // Base fov
        this.fovAmount = 60  

        this.target = new THREE.Vector3(0, 0, 0)    // Current look-at target

        this.tl = null                              // Active GSAP timeline (null = static camera)
        this.loop = false                           // Does the current scene loop
        this.onSceneEnd = null                      // Called when a one-shot animation ends
        this.animElapsed = 0                        // Manual playhead, in seconds
        this.animDone = false                       // Guards a single onSceneEnd call
        this.baseSpeed = 1.0                        // Base animation speed
        this.volumeSpeedFactor = 8.0                // Volume influence on speed

        this.setInstance()
        this.setScenes()
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
        this.controls.enabled = true
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
        // .listen() keeps the slider in sync with the camera
        positionFolder.add(this.instance.position, 'x').min(-20).max(20).step(0.05).name('x').listen().onChange(() => {
            this.controls.update()  // Force OrbitControls to recompute its internal angles
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
        targetFolder.add(this.target, 'x').min(-10).max(10).step(0.05).name('target x').listen()
        targetFolder.add(this.target, 'y').min(-10).max(10).step(0.05).name('target y').listen()
        targetFolder.add(this.target, 'z').min(-10).max(10).step(0.05).name('target z').listen()

        // Animation
        const animationFolder = this.debugFolder.addFolder('animation')
        animationFolder.close()
        animationFolder.add(this, "baseSpeed").min(0).max(10).step(0.01)
        animationFolder.add(this, "volumeSpeedFactor").min(0).max(10).step(0.01)

    }

    // Per-scene camera data: animation or static pose, plus loop flag
    setScenes()
    {
        this.scenes = {
            front: {
                loop: false,
                build: () => gsap.timeline({ paused: true })
                    .fromTo(this.instance.position, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 10, duration: 12, ease: 'none' })
                    .fromTo(this.target, { x: 0, y: 0, z: -10}, { x: 0, y: 0, z: 0, duration: 6 }, 0),
            },
            side: {
                loop: true,
                build: () => {
                    const R = 6                             // Base radius
                    const amp = 4                           // Approach/recede amount
                    const breaths = 2                       // In-out cycles per orbit (keep it an INTEGER, see below)
                    const ampY = 2                          // Vertical amplitude
                    const bob = -2                          // Up-down cycles per orbit (integer)
                    const proxy = { a: 0 }                  // Angle driver
                    return gsap.timeline({ paused: true })
                        .to(proxy, {
                            a: Math.PI * 2,
                            duration: 30,
                            ease: 'none',                   // Constant angular speed
                            onUpdate: () => {
                                const r = R + Math.sin(proxy.a * breaths) * amp
                                this.instance.position.set(r * Math.cos(proxy.a), 0 + ampY * Math.sin(proxy.a * bob), r * Math.sin(proxy.a))
                                this.target.set(0, 0, 0)
                            }
                        })
                },
            },
            closeup: {
                loop: true,
                position: new THREE.Vector3(0, 0.5, 1),
                target: new THREE.Vector3(0, 0.7, 0),
            },
            eye: {
                loop: true,
                position: new THREE.Vector3(0, 0, 8),
                target: new THREE.Vector3(0, 0, 0),
            },
            far: {
                loop: true,
                build: () => {
                    const R = 8
                    const amp = 4
                    const breaths = 2
                    const proxy = { a: 0 }
                    return gsap.timeline({ paused: true })
                        .to(proxy, {
                            a: Math.PI * 2,
                            duration: 30,
                            ease: 'none',
                            onUpdate: () => {
                                const r = R + Math.sin(proxy.a * breaths) * amp
                                this.instance.position.set(r * Math.cos(proxy.a), 0, r * Math.sin(proxy.a))
                                this.target.set(0, 0, 0)
                            }
                        })
                },
            },
        }
    }

    setMode(name)
    {
        const config = this.scenes[name]
        if (this.tl) { this.tl.kill(); this.tl = null }     // Drop the previous timeline
        this.animElapsed = 0
        this.animDone = false
        this.loop = config?.loop ?? true                    // Default to loop so a scene is never stuck

        if (config?.build) {
            this.tl = config.build()                        // Build and hold the paused timeline
            this.tl.pause()
        } else if (config?.position) {
            this.cutToShot(config.position, config.target)  // Static pose
        }
    }

    // Snap the camera to a fixed pose
    cutToShot(position, target)
    {
        this.instance.position.copy(position)
        this.target.copy(target)
        this.instance.lookAt(this.target)
    }

    update()
    {
        const s = this.sound

        if (this.tl) {
            // Advance the playhead manually, scaled by volume (pauses with the loop → host-safe)
            const speed = this.baseSpeed + s.volumeAverageSmooth * this.volumeSpeedFactor
            this.animElapsed += this.time.delta * 0.001 * speed
            const dur = this.tl.duration()

            if (this.loop) {
                this.tl.time(dur > 0 ? this.animElapsed % dur : 0)      // Wrap around
            } else if (this.animElapsed >= dur) {
                this.tl.time(dur)
                if (!this.animDone) { this.animDone = true; this.onSceneEnd?.() }       // Fire once at the end
            } else {
                this.tl.time(this.animElapsed)
            }
            this.instance.lookAt(this.target)
        }

        // FOV pulse
        this.instance.fov = this.baseFov + Math.pow(s.volumeAverageSmooth, 2.0) * this.fovAmount
        this.instance.updateProjectionMatrix()
    }
}