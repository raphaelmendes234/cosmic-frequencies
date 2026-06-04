export default [
    {
        name: 'environmentMapTexture',
        type: 'cubeTexture',
        path: [
            'textures/environmentMap/px.jpg',
            'textures/environmentMap/nx.jpg',
            'textures/environmentMap/py.jpg',
            'textures/environmentMap/ny.jpg',
            'textures/environmentMap/pz.jpg',
            'textures/environmentMap/nz.jpg',
        ]
    },
    {
        name: 'grassColorTexture',
        type: 'texture',
        path: 'textures/dirt/color.jpg',
    },
    {
        name: 'grassNormalTexture',
        type: 'texture',
        path: 'textures/dirt/normal.jpg',
    },
    {
        name: 'foxModel',
        type: 'gltfModel',
        path: 'models/Fox/glTF/Fox.gltf'
    },
    {
        name: 'helmetModel',
        type: 'gltfModel',
        path: 'models/DamagedHelmet/glTF/DamagedHelmet.gltf'
    },
    {
        name: 'eyeModel',
        type: 'gltfModel',
        path: 'models/Eye/eyeDRACO.glb'
    },
    {
        name: 'astronautModel',
        type: 'gltfModel',
        path: 'models/Astronaut/AstronautDRACO.glb'
    },
]