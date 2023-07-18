const params = {
    segments: 50,
    edgeRadius: .07
};

let boxGeometry = new THREE.BoxGeometry(1, 1, 1, params.segments, params.segments, params.segments);

function createDiceGeometry() {
    let boxGeometry = new THREE.BoxGeometry(1, 1, 1, params.segments, params.segments, params.segments);
    const positionAttribute = boxGeometry.attributes.position;

    for (let i = 0; i < positionAttribute.count; i++) {

        let position = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);

        for (let i = 0; i < positionAttribute.count; i++) {

            if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.y) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
                // position is close to box vertex
            } else if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.y) > subCubeHalfSize) {
                // position is close to box edge that's parallel to Z axis
            } else if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
                // position is close to box edge that's parallel to Y axis
            } else if (Math.abs(position.y) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
                // position is close to box edge that's parallel to X axis
            }

        positionAttribute.setXYZ(i, position.x, position.y, position.z);
    }

    return boxGeometry;
}
}