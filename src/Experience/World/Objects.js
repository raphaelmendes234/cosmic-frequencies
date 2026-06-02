import * as THREE from 'three'
import Experience from '../Experience'

import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'

export default class Objects
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.time = this.experience.time
        this.debug = this.experience.debug

        this.mode = 1
        this.elapsedTime = 0
        
        this.setParameters()
        this.setGroup()
        this.setGeometries()
        this.setMeshes()

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
        // --- Paramètres spécifiques aux Objets ---
        this.p.count = 50
        this.p.baseSize = 0.5
        this.p.sizeRange = 1.0
        
        this.p.baseSpeed = 38.0
        this.p.speedRange = 10.0 // Variation de vitesse entre les objets

        // Palettes de couleurs
        this.p.palettes = {
            fire: ['#ff0000', '#ff7f00', '#ffff00'],
            ice: ['#0055ff', '#00ffff', '#ffffff'],
            nature: ['#00ff00', '#228b22', '#adff2f']
        }
        this.p.activeColorMode = 'fire'

        // --- Paramètres de trajectoire (identiques à Beam.js) ---
        this.p.limit = 50.0
        this.p.startDiameter = 0.1
        this.p.endDiameter = 30.0
        this.p.curvature = -4.0
        this.p.waveAmplitude = 0.0
        this.p.waveFrequency = 0.15
        this.p.waveSpeed = 8.0
    }

    setGeometries()
    {
        // On prépare les 4 géométries demandées
        this.geometries = [
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.ConeGeometry(0.5, 1, 8),
            new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
            new THREE.IcosahedronGeometry(0.6, 0)
        ]
    }

    setMeshes()
    {
        this.meshes = []

        for(let i = 0; i < this.p.count; i++)
        {
            const randomGeo = this.geometries[Math.floor(Math.random() * this.geometries.length)]
            
            // 1. On extrait uniquement les arêtes (edges) de la géométrie 3D
            const edges = new THREE.EdgesGeometry(randomGeo)
            
            // 2. On la convertit pour le système de lignes épaisses
            const lineGeometry = new LineSegmentsGeometry().fromEdgesGeometry(edges)
            
            // 3. On utilise le LineMaterial
            const material = new LineMaterial({
                color: 0xffffff,
                linewidth: 4, // <-- ICI tu peux choisir ton épaisseur en pixels !
                resolution: new THREE.Vector2(this.experience.sizes.width, this.experience.sizes.height), // Indispensable pour calculer l'épaisseur
                transparent: true,
                opacity: 0,
                depthWrite: false // Souvent utile avec la transparence
            })

            // 4. On utilise Line2 au lieu de THREE.Mesh
            const mesh = new Line2(lineGeometry, material)
            mesh.computeLineDistances()
            
            // Génération de la taille (on garde ton code)
            const scale = this.p.baseSize + Math.random() * this.p.sizeRange
            mesh.scale.set(scale, scale, scale)

            // Stockage des variables userData (on garde ton code)
            mesh.userData = {
                angle: Math.random() * Math.PI * 2.0,                   
                offsetZ: (Math.random() - 0.5) * 2.0 * this.p.limit,    
                speedOffset: (Math.random() - 0.5) * 2.0,               
                colorIndex: Math.floor(Math.random() * 3),              
                rotationSpeed: {
                    x: (Math.random() - 0.5) * 4.0,                     
                    y: (Math.random() - 0.5) * 4.0,
                    z: (Math.random() - 0.5) * 4.0
                }
            }

            this.group.add(mesh)
            this.meshes.push(mesh)
        }

        this.changeColorMode(this.p.activeColorMode)
    }

    setMode(modeNumber)
    {
        this.mode = modeNumber

        // Les paramètres doivent matcher exactement ceux que tu as mis dans Beam.js pour setMode()
        if (this.mode === 1) {
            this.group.rotation.set(0, 0, 0)
            this.p.startDiameter = 0.1
            this.p.endDiameter = 30.0
            this.p.curvature = -4.0
            this.changeColorMode("fire")
        } 
        else if (this.mode === 2) {
            this.group.rotation.set(0, Math.PI, 0)
            this.p.startDiameter = 10.0
            this.p.endDiameter = 30.0
            this.p.curvature = -4.0
            this.changeColorMode("ice")
        } 
        else if (this.mode === 3) {
            this.group.rotation.set(-Math.PI * 0.5, 0, 0)
            this.p.startDiameter = 20.0
            this.p.endDiameter = 20.0
            this.p.curvature = 0.0
            this.changeColorMode("nature")
        }

        if(this.debug.active && this.debugFolder)
        {
            this.refreshGuiDisplay(this.debugFolder)
        }
    }

    changeColorMode(modeName)
    {
        this.p.activeColorMode = modeName
        const palette = this.p.palettes[modeName]

        // On applique les nouvelles couleurs à chaque objet
        for(const mesh of this.meshes)
        {
            const colorHex = palette[mesh.userData.colorIndex]
            mesh.material.color.set(colorHex)
            mesh.material.color.multiplyScalar(2.0)
        }
    }

    setDebug()
    {
        this.debugFolder = this.debug.gui.addFolder("wireframe objects")
        
        // Settings spécifiques
        const settingsFolder = this.debugFolder.addFolder("settings")
        // On ne met pas de controle sur 'count' en temps réel car il faudrait détruire/recréer les meshes.
        // Mais on peut jouer sur la taille et la vitesse.
        settingsFolder.add(this.p, "baseSize").min(0.1).max(5).step(0.1).name("base size").onChange(() => this.updateScales())
        settingsFolder.add(this.p, "sizeRange").min(0).max(5).step(0.1).name("size range").onChange(() => this.updateScales())
        settingsFolder.add(this.p, "baseSpeed").min(0).max(100).step(0.1).name("base speed")
        settingsFolder.add(this.p, "speedRange").min(0).max(50).step(0.1).name("speed range")

        // Trajectoire (Lien mathématique direct avec Beam.js)
        const pathFolder = this.debugFolder.addFolder("path params (sync with beam)")
        pathFolder.add(this.p, "limit").min(0).max(40).step(0.01)
        pathFolder.add(this.p, "startDiameter").min(0.1).max(100).step(0.1)
        pathFolder.add(this.p, "endDiameter").min(0.1).max(100).step(0.1)
        pathFolder.add(this.p, "curvature").min(-15).max(15).step(0.1)
        pathFolder.add(this.p, "waveAmplitude").min(0).max(10).step(0.05)
        pathFolder.add(this.p, "waveFrequency").min(0).max(10).step(0.01)
        pathFolder.add(this.p, "waveSpeed").min(-30).max(30).step(0.1)
    }

    updateScales()
    {
        for(const mesh of this.meshes) {
            // On recalcule une échelle basée sur le random d'origine (on utilise userData.speedOffset comme graine pseudo-aléatoire pour rester constant)
            const pseudoRandom = Math.abs(mesh.userData.speedOffset) / 2.0 
            const scale = this.p.baseSize + pseudoRandom * this.p.sizeRange
            mesh.scale.set(scale, scale, scale)
        }
    }

    refreshGuiDisplay(folder)
    {
        if(!folder) return
        folder.controllers.forEach(controller => controller.updateDisplay())
        folder.folders.forEach(subFolder => this.refreshGuiDisplay(subFolder))
    }

    resize()
    {
        for(const mesh of this.meshes)
        {
            mesh.material.resolution.set(this.experience.sizes.width, this.experience.sizes.height)
        }
    }

    update()
    {
        const deltaTime = this.time.delta
        this.elapsedTime += deltaTime * 0.001 // Equivalent à uTime

        for(const mesh of this.meshes)
        {
            const data = mesh.userData

            // --- 1. Calcul du Z (Avancée dans le tube) ---
            const currentSpeed = this.p.baseSpeed + (data.speedOffset * this.p.speedRange)
            const zMovement = data.offsetZ + this.elapsedTime * currentSpeed
            
            const totalDist = this.p.limit * 2.0
            
            // JS modulo function fix (similaire à mod() en GLSL)
            let modZ = ((zMovement + this.p.limit) % totalDist + totalDist) % totalDist - this.p.limit
            const normZ = modZ / this.p.limit

            // --- 2. Calcul du Rayon du tube à cet endroit Z ---
            const startRadius = this.p.startDiameter * 0.5
            const endRadius = this.p.endDiameter * 0.5
            
            // Equivalent du mix() GLSL
            const baseRadius = startRadius * (1.0 - ((normZ + 1.0) * 0.5)) + endRadius * ((normZ + 1.0) * 0.5)
            const curveFactor = 1.0 - (normZ * normZ)
            const radius = baseRadius + this.p.curvature * curveFactor

            // --- 3. Calcul du X et Y (Cercle + Vague) ---
            const dirX = Math.cos(data.angle)
            const dirY = Math.sin(data.angle)
            
            let centerX = dirX * radius
            let centerY = dirY * radius

            // Ajout de l'effet de vague (identique au shader de Beam)
            const wavePhase = modZ * this.p.waveFrequency - this.elapsedTime * this.p.waveSpeed + data.angle * 1.5
            const waveEffect = Math.sin(wavePhase) * this.p.waveAmplitude
            centerY += waveEffect

            // --- 4. Application ---
            mesh.position.set(centerX, centerY, modZ)

            // Fading (Equivalent du smoothstep de vAlpha sur le shader)
            // On fait disparaitre l'objet quand il arrive au bout (proche de uLimit ou -uLimit)
            const distToLimit = this.p.limit - Math.abs(modZ)
            // Calcul smoothstep manuel
            let alpha = distToLimit / 1.0 // 1.0 est la zone de fade
            alpha = Math.max(0.0, Math.min(1.0, alpha)) // Clamp entre 0 et 1
            mesh.material.opacity = alpha * alpha * (3.0 - 2.0 * alpha) // Smoothstep formula

            // --- 5. Rotation de l'objet sur lui-même (Optionnel mais joli) ---
            mesh.rotation.x += deltaTime * 0.001 * data.rotationSpeed.x
            mesh.rotation.y += deltaTime * 0.001 * data.rotationSpeed.y
            mesh.rotation.z += deltaTime * 0.001 * data.rotationSpeed.z
        }
    }
}