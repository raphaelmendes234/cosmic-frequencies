import Experience from '../Experience'
import Astronaut from './Astronaut'
import Beam from './Beam'
import Environment from './Environment'
import Eye from './Eye'
import Floor from './Floor'
import Fox from './Fox'
import Helmet from './Helmet'
import Lights from './Lights'
import Manager from './Manager'
import Objects from './Objects'

export default class World
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.ressources = this.experience.ressources

        // Wait for ressources
        this.ressources.on('loaded', () => 
        {
            // Setup
            // this.helmet = new Helmet()
            this.beam = new Beam()
            // this.objects = new Objects()
            this.eye = new Eye()
            this.astronaut = new Astronaut()
            this.lights = new Lights()

            this.manager = new Manager()
            this.manager.switchScene(1)
        })

    }

    update()
    {
        if(this.fox){
            this.fox.update()
        }

        if (this.helmet) {
            this.helmet.update()
        }

        if (this.eye) {
            this.eye.update()
        }

        if (this.astronaut) {
            this.astronaut.update()
        }

        if (this.beam) {
            this.beam.update()
        }

        if (this.objects) {
            this.objects.update()
        }
    }
}