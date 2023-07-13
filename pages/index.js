import { useEffect, useRef } from "react"
import * as THREE from 'three'

export default function Intro() {
  
  let gui

  let camera, scene, renderer, initialized
  let geometry, material, mesh, origMesh

  let progress = {
    value: .5
  }
  let color = {
    range: .5,
    value: .8,
    satuation: .9
  }

  const fShader = `
    precision highp float;

    uniform sampler2D map;
    uniform float colorRange;
    uniform float satuation;
    uniform float value;
    uniform float time;

    varying vec2 vUv;
    varying float vScale;

    // HSL to RGB Convertion helpers
    vec3 HUEtoRGB(float H){
      H = mod(H,1.0);
      float R = abs(H * 6.0 - 3.0) - 1.0;
      float G = 2.0 - abs(H * 6.0 - 2.0);
      float B = 2.0 - abs(H * 6.0 - 4.0);
      return clamp(vec3(R,G,B),0.0,1.0);
    }

    vec3 HSLtoRGB(vec3 HSL){
      vec3 RGB = HUEtoRGB(HSL.x);
      float C = (1.0 - abs(2.0 * HSL.z - 1.0)) * HSL.y;
      return (RGB - 0.5) * C + HSL.z;
    }

    void main() {
      vec4 diffuseColor = texture2D( map, vUv );
      gl_FragColor = vec4( diffuseColor.xyz * HSLtoRGB(vec3(vScale*colorRange + time * .5, satuation, value)), diffuseColor.w );

      if ( diffuseColor.w < 0.5 ) discard;
    }
  `;

  const vShader = `
    precision highp float;
    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;
    uniform float time;
    uniform float progressIn;
    uniform float progressOut;


    attribute vec3 position;
    attribute vec2 uv;
    attribute vec3 translate;

    varying vec2 vUv;
    varying float vScale;

    void main() {

      //modifier
      float l = length(translate);
      float inAmp = max((progressIn*3.-l)/l, .0);
      float outAmp = max(-(pow(progressOut, 2.)*3.-l)/l, .0);

      //position
      vec4 mvPosition = modelViewMatrix * vec4( translate * inAmp * outAmp, 1.0 );

      //scale animation
      vec3 trTime = vec3(translate.x + time,translate.y + time,translate.z + time);
      float scale =  sin( trTime.x * 2.1 ) + sin( trTime.y * 3.2 ) + sin( trTime.z * 4.3 );

      vScale = scale;
      scale = (scale * 5.0 + 5.0);
      mvPosition.xyz += position * scale;
      vUv = uv;
      gl_Position = projectionMatrix * mvPosition;

    }
  `;

  const init = async () => {

    if(initialized) return
    initialized = true
    
    renderer = new THREE.WebGLRenderer()
    renderer.setPixelRatio( window.devicePixelRatio )
    renderer.setSize( window.innerWidth, window.innerHeight )
    renderer.useLegacyLights = false
    wrapper.current.appendChild( renderer.domElement )

    camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1 , 5000 )
    camera.position.z = 1400
    
    //scene
    scene = new THREE.Scene()
    const circle = new THREE.CircleGeometry( 1, 24 )

    geometry = new THREE.InstancedBufferGeometry()
    geometry.index = circle.index
    geometry.attributes = circle.attributes

    const size = 32
    const size2 = Math.pow(size, 2)
    const size3 = Math.pow(size, 3)
    const translateArray = new Float32Array( size3 * 3 )

    for ( let i = 0, i3 = 0, l = size3; i < l; i++, i3 += 3) {

      /*
      translateArray[ i3 + 0 ] = Math.random() * 2 - 1
      translateArray[ i3 + 1 ] = Math.random() * 2 - 1
      translateArray[ i3 + 2 ] = Math.random() * 2 - 1
      */
      
      translateArray[ i3 + 0 ] = Math.floor(i3/size2%size-size/2) / (size/2)
      translateArray[ i3 + 1 ] = Math.floor(i3/size%size-size/2) / (size/2)
      translateArray[ i3 + 2 ] = Math.floor(i3%size-size/2) / (size/2)
      
    }

    geometry.setAttribute( 'translate', new THREE.InstancedBufferAttribute( translateArray, 3))

    material = new THREE.RawShaderMaterial( {
      uniforms: {
        'map': { value: new THREE.TextureLoader().load( './tex/circle.png' ) },
        'time': { value: .0 },
        'progressIn': { value: .0 },
        'progressOut': { value: .0 },
        'colorRange': { value: .5 },
        'value': { value: .8 },
        'satuation': { value: .9 }
      },
      vertexShader: vShader,
      fragmentShader: fShader,
      depthTest: true,
      depthWrite: true
    } )

    mesh = new THREE.Mesh (geometry, material)
    mesh.scale.set( 400, 400, 400)
    scene.add( mesh )

    //add origin
    let origMat = new THREE.MeshNormalMaterial()
    const origGeo = new THREE.SphereGeometry( 1, 32 )
    origMesh = new THREE.Mesh (origGeo, origMat)
    scene.add( origMesh )

    window.addEventListener( 'resize', onWindowResize )
    
    //GUI
    const {GUI} = await import('dat.gui')
    gui = new GUI()

    const progressFolder = gui.addFolder('progress')
    progressFolder.add(progress, 'value', 0, 1)
    progressFolder.open()
    const colorFolder = gui.addFolder('color')
    colorFolder.add(material.uniforms[ 'colorRange' ], 'value', 0, 1)
    colorFolder.open()


    //render
    animate()

  }

  const onWindowResize = () => {
    camera.aspect = window.innerWidth/window.innerHeight
    camera.updateProjectionMatrix()

    renderer.setSize( window.innerWidth, window.innerHeight)
  }

  const animate = () => {

    requestAnimationFrame(animate)

    const time = performance.now() * 0.0005
    material.uniforms[ 'time' ].value = time
    material.uniforms[ 'progressIn' ].value = Math.min(progress.value * 2, 1)
    material.uniforms[ 'progressOut' ].value = Math.max(progress.value * 2 - 1, 0)

    mesh.rotation.x = time * 0.2
    mesh.rotation.y = time * 0.4

    camera.position.z = 1400 + (1 - Math.pow(progress.value * 2 - 1, 2)) * 1400

    renderer.render( scene, camera )

  }

  const wrapper = useRef()

  useEffect(() => {

    init()

    return () => {
    }

  },[])

  return (
    <>
    <style>{`
      body {
        margin: 0;
      }
    `}</style>
    <div ref={wrapper}>
    </div>
    </>
  )
}
