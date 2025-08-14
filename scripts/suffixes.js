import addressData from '../public/address-data.js';

const suffixes = new Set();

for (const st in addressData) {
    const parts = st.split(' ');
    let suffix = parts.pop();
    if (suffix === 'NORTH' || suffix === 'EAST' ||
        suffix === 'SOUTH' || suffix === 'WEST') {
        suffix = parts.pop();
    }
    suffixes.add(suffix);
}

console.log(Array.from(suffixes).sort());
