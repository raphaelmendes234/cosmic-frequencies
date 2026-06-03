import * as THREE from 'three'
import Experience from '../Experience'

export default class Beam
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.time = this.experience.time
        this.debug = this.experience.debug
        this.sound = this.experience.sound

        this.mode = 1
        
        this.setParameters()
        this.setGroup()
        this.setGeometry()
        this.setMaterial()
        this.setInstancedMesh()

        if(this.debug.active)
        {
            this.setDebug()
        }
    }

    setGroup()
    {
        this.group = new THREE.Group()
        this.scene.add(this.group)
    }

    setParameters()
    {
        this.p = {}
        this.p.maxCount = 1000.0
        this.p.count = 300.0

        this.p.limit = 50.0
        this.p.startDiameter = 0.1
        this.p.endDiameter = 30.0
        this.p.curvature = -4.0
        this.p.noiseStrength = 0.3

        this.p.waveAmplitude = 0.0   // hauteur/force de la déformation
        this.p.waveFrequency = 0.0  // nb de vagues
        this.p.waveSpeed = 8.0

        this.p.speed = 10.0
        this.p.speedRandomness = 1.0

        this.p.length = 10.0
        this.p.lengthRange = 1.0

        this.p.thickness = 0.01
        this.p.thicknessRange = 0.05

        this.p.palettes = {
            fire: [new THREE.Color('#ff0000'), new THREE.Color('#ff7f00'), new THREE.Color('#ffff00')],
            ice: [new THREE.Color('#0055ff'), new THREE.Color('#00ffff'), new THREE.Color('#ffffff')],
            nature: [new THREE.Color('#00ff00'), new THREE.Color('#228b22'), new THREE.Color('#adff2f')]
        }
        this.p.activeColorMode = 'fire'
        this.p.colorProgress = 1.0

        /**
         * Audio
         */
        this.p.audioThickness = 0.1
        this.p.audioAmplitude = 10.0
        this.p.audioFrequency = 1.0
    }

    setGeometry()
    {
        this.geometry = new THREE.CylinderGeometry(1, 1, 3, 16, 40)

        const offsets = new Float32Array(this.p.maxCount * 3)
        const randoms = new Float32Array(this.p.maxCount * 3)
        const noises = new Float32Array(this.p.maxCount * 2)
        const colorIndices = new Float32Array(this.p.maxCount)
     
        for (let i = 0; i < this.p.maxCount; i++) {
            // offsets
            offsets[i * 3 + 0] = Math.random() * Math.PI * 2.0 // angle sur le cercle (de 0 à 2*PI)
            offsets[i * 3 + 1] = 0.0 // inutilisé
            offsets[i * 3 + 2] = (Math.random() - 0.5) * 2.0 * this.p.limit // position Z de départ aléatoire dans le tube

            // speed & dimensions
            randoms[i * 3 + 0] = Math.random() * 1.8 + 0.2  // speed
            randoms[i * 3 + 1] = Math.random()              // length
            randoms[i * 3 + 2] = Math.random()              // thickness

            // décalage sur x et y
            noises[i * 2 + 0] = (Math.random() - 0.5) * 2.0
            noises[i * 2 + 1] = (Math.random() - 0.5) * 2.0

            // color
            colorIndices[i] = Math.floor(Math.random() * 3)
        }

        this.geometry.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 3))
        this.geometry.setAttribute("aRandom", new THREE.InstancedBufferAttribute(randoms, 3))
        this.geometry.setAttribute("aNoise", new THREE.InstancedBufferAttribute(noises, 2))
        this.geometry.setAttribute("aColorIndex", new THREE.InstancedBufferAttribute(colorIndices, 1))
    }

    setMaterial()
    {
        this.material = new THREE.ShaderMaterial({
            side: THREE.DoubleSide,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            uniforms: {
                uTime: { value: 0 },
                uLimit: { value: this.p.limit },
                uStartDiameter: { value: this.p.startDiameter },
                uEndDiameter: { value: this.p.endDiameter },
                uCurvature: { value: this.p.curvature },
                uNoiseStrength: { value: this.p.noiseStrength },
                uWaveAmplitude: { value: this.p.waveAmplitude },
                uWaveFrequency: { value: this.p.waveFrequency },
                uWaveSpeed: { value: this.p.waveSpeed },
                uSpeed: { value: this.p.speed},
                uSpeedRandomness : { value: this.p.speedRandomness},
                uLength: { value: this.p.length},
                uLengthRange: { value: this.p.lengthRange},
                uThickness: { value: this.p.thickness},
                uThicknessRange: { value: this.p.thicknessRange},
                uPalette1: { value: this.p.palettes.fire },
                uPalette2: { value: this.p.palettes.fire },
                uColorProgress: { value: this.p.colorProgress },
            },
            vertexShader: `
                uniform float uTime;
                uniform float uLimit;

                uniform float uStartDiameter;
                uniform float uEndDiameter;
                uniform float uCurvature;
                uniform float uNoiseStrength;

                uniform float uWaveAmplitude;
                uniform float uWaveFrequency;
                uniform float uWaveSpeed;

                uniform float uSpeed;
                uniform float uSpeedRandomness;
        
                uniform float uLength;
                uniform float uLengthRange;
                uniform float uThickness;
                uniform float uThicknessRange;

                attribute vec3 aOffset;     // x: angle, y: vide, z: z de départ
                attribute vec3 aRandom;     // x: vitesse, y: longueur, z: épaisseur
                attribute vec2 aNoise;      // x, y: facteurs de bruit aléatoires
                attribute float aColorIndex;

                varying vec2 vUv;
                varying float vAlpha;
                varying float vColorIndex;
            
                void main(){
                    // rotate le cylindre
                    vec3 localPosition = vec3(position.x, position.z, position.y);

                     // dimensions (length, thickness)
                    float currentLength = uLength + (aRandom.y * uLengthRange);
                    float currentThickness = uThickness + (aRandom.z * uThicknessRange);

                    // apply dimensions
                    localPosition.x *= currentThickness;
                    localPosition.y *= currentThickness; 
                    localPosition.z *= currentLength;    
                    
                    // defilement infini sur Z
                    float currentMultiplier = mix(1.0, aRandom.x, uSpeedRandomness);
                    float zMovement = aOffset.z + uTime * uSpeed * currentMultiplier;
                    float totalDist = uLimit * 2.0;
                    float modZ = mod(zMovement + uLimit, totalDist) - uLimit;
                    
                    float vertexZ = modZ + localPosition.z;
                    float normZ = vertexZ / uLimit;

                    // forme du cone
                    float startRadius = uStartDiameter * 0.5;
                    float endRadius = uEndDiameter * 0.5;
                    float baseRadius = mix(startRadius, endRadius, (normZ + 1.0) * 0.5);
                    float curveFactor = 1.0 - normZ * normZ;
                    
                    // rayon sans la vague (la vague est extraite du rayon pour aller sur le Y global)
                    float radius = baseRadius + uCurvature * curveFactor;

                    // positionnement circulaire initial de la particule
                    float angle = aOffset.x;
                    vec2 dir = vec2(cos(angle), sin(angle));
                    vec2 centerXY = dir * radius + aNoise * uNoiseStrength;

                    // deformation axe y gloabal
                    // aOffset.x * 1.5 permet de désynchroniser légèrement les rayons entre eux pour un effet organique
                    float wavePhase = vertexZ * uWaveFrequency - uTime * uWaveSpeed + aOffset.x * 1.5;
                    float waveEffect = sin(wavePhase) * uWaveAmplitude;
                    
                    centerXY.y += waveEffect; 

                    // calcul pente (Dérivée par rapport à Z)
                    float d_normZ = 1.0 / uLimit;
                    float d_radius = (endRadius - startRadius) * 0.5 * d_normZ - 2.0 * normZ * uCurvature * d_normZ;
                    
                    // dérivée de la vague sinusoïdale sur Y (dérivée de sin = cos)
                    float d_waveY = cos(wavePhase) * uWaveFrequency * uWaveAmplitude;

                    // construction du vecteur Tangent (prend en compte la pente du rayon + le creux de la vague en Y)
                    vec3 tangent = normalize(vec3(dir.x * d_radius, dir.y * d_radius + d_waveY, 1.0));
                    
                    // génération d'un repère orthonormé robuste (Gram-Schmidt) pour éviter les déformations de maillage
                    vec3 roughBinormal = vec3(-dir.y, dir.x, 0.0);
                    vec3 normal = normalize(cross(tangent, roughBinormal));
                    vec3 binormal = cross(normal, tangent);

                    // position finale combinant le centre ondulé et l'épaisseur du cylindre orientée
                    vec3 finalPosition = vec3(centerXY, vertexZ) + localPosition.x * binormal + localPosition.y * normal;

                    vec4 modelPosition = modelMatrix * vec4(finalPosition, 1.0);
                    gl_Position = projectionMatrix * viewMatrix * modelPosition;

                    vUv = uv;
                    float distToLimit = uLimit - abs(finalPosition.z);
                    vAlpha = smoothstep(0.0, 1.0, distToLimit);
                    vColorIndex = aColorIndex;
                }
            `,
            fragmentShader: `
                uniform vec3 uPalette1[3];
                uniform vec3 uPalette2[3];
                uniform float uColorProgress;

                varying vec2 vUv;
                varying float vAlpha;
                varying float vColorIndex;

                void main(){
                    int index = int(vColorIndex);
                    vec3 color1 = uPalette1[index];
                    vec3 color2 = uPalette2[index];

                    vec3 finalColor = mix(color1, color2, uColorProgress);

                    gl_FragColor = vec4(finalColor, vAlpha);
                }
            `
        })
    }

    setInstancedMesh()
    {
        this.mesh = new THREE.InstancedMesh( this.geometry, this.material, this.p.maxCount )
        this.mesh.count = this.p.count
        this.group.add(this.mesh)
    }

    setMode(modeNumber)
    {
        this.mode = modeNumber

        if (this.mode === 1) {
            // group rota
            this.group.rotation.set(0, Math.PI, 0)

            // beams params
            this.p.startDiameter = 30.0
            this.p.endDiameter = 0.1
            this.p.curvature = -4.0
            this.changeColorMode("fire")
        } 
        else if (this.mode === 2) {
            // group rota
            this.group.rotation.set(0, Math.PI, 0)

            // beams params
            this.p.startDiameter = 10.0
            this.p.endDiameter = 30.0
            this.p.curvature = -4.0
            this.changeColorMode("ice")
        } 
        else if (this.mode === 3) {
            // group rota
            this.group.rotation.set(-Math.PI * 0.5, 0, 0)

            // beams params
            this.p.startDiameter = 20.0
            this.p.endDiameter = 20.0
            this.p.curvature = 0.0
            this.changeColorMode("nature")
        }

        // refresh debug
        if(this.debug.active && this.debugFolder)
        {
            this.refreshGuiDisplay(this.debugFolder)
        }
    }
    
    changeColorMode(modeName)
    {
        const currentColors = []
        for(let i = 0; i < 3; i++) {
            const c1 = this.material.uniforms.uPalette1.value[i]
            const c2 = this.material.uniforms.uPalette2.value[i]
            const mixedColor = new THREE.Color().copy(c1).lerp(c2, this.p.colorProgress)
            currentColors.push(mixedColor)
        }
        
        this.material.uniforms.uPalette1.value = currentColors
        this.material.uniforms.uPalette2.value = this.p.palettes[modeName]
        this.p.colorProgress = 0.0
    }

    updateOffsets()
    {
        const offsets = this.geometry.attributes.aOffset.array
        
        for (let i = 0; i < this.p.maxCount; i++) {
            offsets[i * 3 + 0] = Math.random() * Math.PI * 2.0
            offsets[i * 3 + 1] = 0.0
            offsets[i * 3 + 2] = (Math.random() - 0.5) * 2.0 * this.p.limit
        }
        
        this.geometry.attributes.aOffset.needsUpdate = true
    }

    setDebug()
    {
        this.debugFolder = this.debug.gui.addFolder("BEAMS")
        this.debugFolder.close()

        // audio
        const audioFolder = this.debugFolder.addFolder("audio reactivity")
        audioFolder.add(this.p, "audioThickness").min(0).max(1).step(0.001)
        audioFolder.add(this.p, "audioAmplitude").min(0).max(10).step(0.001)
        audioFolder.add(this.p, "audioFrequency").min(0).max(10).step(0.001)
        
        // group
        const groupFolder = this.debugFolder.addFolder("group")
        groupFolder.add(this.group.rotation, 'x').min(-Math.PI).max(Math.PI).step(0.01).name('rotation X')
        groupFolder.add(this.group.rotation, 'y').min(-Math.PI).max(Math.PI).step(0.01).name('rotation Y')
        groupFolder.add(this.group.rotation, 'z').min(-Math.PI).max(Math.PI).step(0.01).name('rotation Z')
        
        // beams controls
        const globalFolder = this.debugFolder.addFolder("global")
        globalFolder.add(this.p, "count").min(0).max(this.p.maxCount).step(1).name("count").onChange((value) => { this.mesh.count = value })
        globalFolder.add(this.p, "limit").min(0).max(40).step(0.01).name("zone z").onChange(() => { this.updateOffsets() })

        // speed
        const speedFolder = this.debugFolder.addFolder("speed")
        speedFolder.add(this.p, "speed").min(0).max(100).step(0.01).name("speed")
        speedFolder.add(this.p, "speedRandomness").min(0).max(1).step(0.01).name("speed gap")

        // length
        const lengthFolder = this.debugFolder.addFolder("length")
        lengthFolder.add(this.p, "length").min(0).max(50).step(0.01).name("length")
        lengthFolder.add(this.p, "lengthRange").min(0).max(1).step(0.01)

        // thickness
        const thicknessFolder = this.debugFolder.addFolder("thickness")
        thicknessFolder.add(this.p, "thickness").min(0).max(0.2).step(0.001).name("thickness")
        thicknessFolder.add(this.p, "thicknessRange").min(0).max(1).step(0.01)

        // forme du tube
        const tubeFolder = this.debugFolder.addFolder("tube form")
        tubeFolder.add(this.p, "startDiameter").min(0.1).max(100).step(0.1).name("start diameter (z-)")
        tubeFolder.add(this.p, "endDiameter").min(0.1).max(100).step(0.1).name("end diameter (z+)")
        tubeFolder.add(this.p, "curvature").min(-15).max(15).step(0.1).name("curve (- in / + out)")
        tubeFolder.add(this.p, "noiseStrength").min(0).max(5).step(0.01).name("alignment noise")

        // deformation
        const waveFolder = this.debugFolder.addFolder("sinus deform")
        waveFolder.add(this.p, "waveAmplitude").min(0).max(10).step(0.05).name("amplitude")
        waveFolder.add(this.p, "waveFrequency").min(0).max(10).step(0.01).name("frequence")
        waveFolder.add(this.p, "waveSpeed").min(-30).max(30).step(0.1).name("wave speed")
        
        // couleurs
        const colorFolder = this.debugFolder.addFolder("sinus deform")
        colorFolder.add(this.p, 'activeColorMode', ['fire', 'ice', 'nature']).name('color ambiance').onChange((newMode) => { this.changeColorMode(newMode) })
    }

    refreshGuiDisplay(folder)
    {
        if(!folder) return
        
        // update folder sliders
        folder.controllers.forEach(controller => controller.updateDisplay())
        // update children files
        folder.folders.forEach(subFolder => this.refreshGuiDisplay(subFolder))
    }

    update()
    {
        const deltaTime = this.time.delta

        const s = this.sound

        this.material.uniforms.uTime.value += deltaTime * 0.001

        this.material.uniforms.uLimit.value = this.p.limit

        this.material.uniforms.uStartDiameter.value = this.p.startDiameter
        this.material.uniforms.uEndDiameter.value = this.p.endDiameter
        this.material.uniforms.uCurvature.value = this.p.curvature
        this.material.uniforms.uNoiseStrength.value = this.p.noiseStrength

        this.material.uniforms.uWaveAmplitude.value = Math.pow(s.volumeAverageSmooth, 3.0) * this.p.audioAmplitude
        this.material.uniforms.uWaveFrequency.value = this.p.waveFrequency
        this.material.uniforms.uWaveSpeed.value = this.p.waveSpeed

        this.material.uniforms.uSpeed.value = this.p.speed
        this.material.uniforms.uSpeedRandomness.value = this.p.speedRandomness

        this.material.uniforms.uLength.value = this.p.length
        this.material.uniforms.uLengthRange.value = this.p.lengthRange

        this.material.uniforms.uThickness.value = this.p.thickness + s.kickHard * this.p.audioThickness
        this.material.uniforms.uThicknessRange.value = this.p.thicknessRange

        // Gestion du Crossfade des couleurs
        if (this.p.colorProgress < 1.0) {
            this.p.colorProgress += deltaTime * 0.002 
            if (this.p.colorProgress > 1.0) {
                this.p.colorProgress = 1.0
            }
            this.material.uniforms.uColorProgress.value = this.p.colorProgress
        }
    }
}