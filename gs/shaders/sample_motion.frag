// SPDX-License-Identifier: LGPL-3.0+
// Motion scanout (Road Trip recomp): like sample_depth.frag, but reads the per-pixel screen motion
// the ubershader stored where Z was written (motion buffer, one packed half2 per 32-bit Z word;
// slice 0 = sample 0, slice 1 + s = sample s) and writes it as RG (GS pixels, current minus
// previous position).

#version 450

#extension GL_EXT_shader_16bit_storage : require
#include "data_structures.h"
#include "swizzle_utils.h"
#include "utils.h"
#include "scanout_sampling.h"

layout(location = 0) out vec4 FragMotion;

layout(set = 0, binding = 0) readonly buffer VRAM32
{
    uint data[];
} vram32;

layout(set = 0, binding = 1) readonly buffer Motion
{
    uint data[];
} motion;

layout(push_constant) uniform Registers
{
    uint zbp;
    uint fbw;
    uint dbx;
    uint dby;
    uint phase;
    uint phase_stride;
} registers;

layout(constant_id = 0) const int PSM = PSMZ24;
layout(constant_id = 1) const uint VRAM_MASK = 4 * 1024 * 1024 - 1;
layout(constant_id = 2) const uint SUPER_SAMPLES = 1;

bool super_sample_is_valid(uint addr)
{
    uint payload = vram32.data[addr + (VRAM_MASK + 1) / 4];
    return PSM == PSMZ24 ? (payload & 0xffffffu) == 0xffffffu : payload == ~0u;
}

void main()
{
    uvec2 super_sampled_coord = uvec2(gl_FragCoord.xy);
    uvec2 single_sampled_coord = SCAN_BY_SAMPLE_POSITION && SUPER_SAMPLES > 1 ? scan_single_sampled_coord(super_sampled_coord)
                               : SUPER_SAMPLES >= 4 ? (super_sampled_coord >> 1) : super_sampled_coord;
    uvec2 coord = single_sampled_coord * uvec2(1u, registers.phase_stride) +
        uvec2(registers.dbx, registers.dby + registers.phase);
    uint addr = swizzle_PS2(coord.x, coord.y, registers.zbp * PGS_BLOCKS_PER_PAGE, registers.fbw, PSM, VRAM_MASK);

    uint m;
    if (SCAN_BY_SAMPLE_POSITION && SUPER_SAMPLES > 1 && super_sample_is_valid(addr))
        m = motion.data[addr + (1u + uint(findLSB(scan_samples_in_pixel(super_sampled_coord)))) * ((VRAM_MASK + 1) / 4)];
    else if (SUPER_SAMPLES >= 4 && super_sample_is_valid(addr))
    {
        uint quad_offset;
        if (SUPER_SAMPLES != 8)
            quad_offset = (super_sampled_coord.y & 1u) + (super_sampled_coord.x & 1u) * 2u;
        else
            quad_offset = (super_sampled_coord.x & 1u) + (super_sampled_coord.y & 1u) * 2u;
        m = motion.data[addr + (1u + (SUPER_SAMPLES / 4u) * quad_offset) * ((VRAM_MASK + 1) / 4)];
    }
    else
        m = motion.data[addr];

    FragMotion = vec4(unpackHalf2x16(m), 0.0, 1.0);
}
