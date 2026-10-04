// SPDX-License-Identifier: LGPL-3.0+
// Road Trip recomp: scanning out super-samples by position (VSyncInfo::progressive_field_scanout).
// An output pixel covers 1 / 2^SCAN_X_LOG2 x 1 / 2^SCAN_Y_LOG2 of a frame-buffer pixel; it takes
// the super-samples whose positions fall inside it. Sample positions match the ubershader's
// patterns (compute_sample_points in gs_renderer.cpp), in units of 1 / 2^RATE_Y_LOG2 pixel.
#ifndef SCANOUT_SAMPLING_H_
#define SCANOUT_SAMPLING_H_

layout(constant_id = 3) const bool SCAN_BY_SAMPLE_POSITION = false;
layout(constant_id = 4) const uint SCAN_X_LOG2 = 1;
layout(constant_id = 5) const uint SCAN_Y_LOG2 = 1;
layout(constant_id = 6) const uint RATE_X_LOG2 = 1;
layout(constant_id = 7) const uint RATE_Y_LOG2 = 1;

uvec2 scan_sample_position(uint i)
{
    uvec2 p;
    if (RATE_Y_LOG2 - RATE_X_LOG2 == 2u)
    {
        const uint sparse_offsets[4] = uint[](0u, 2u, 3u, 1u);
        p = uvec2((i / 8u) * 4u + sparse_offsets[i % 4u], i % 8u);
    }
    else
    {
        p.y = (i & 1u) + ((i >> 2u) & 1u) * 2u;
        p.x = ((i >> 1u) & 1u) + ((i >> 3u) & 1u) * 2u;
        if (RATE_Y_LOG2 - RATE_X_LOG2 == 1u)
            p.x = p.x * 2u + (i % 2u);
    }
    return p;
}

// Bit i set: super-sample i lies in the output pixel at gl_FragCoord `frag`.
uint scan_samples_in_pixel(uvec2 frag)
{
    uvec2 cell = frag & uvec2((1u << SCAN_X_LOG2) - 1u, (1u << SCAN_Y_LOG2) - 1u);
    uint mask = 0u;
    const uint count = 1u << (RATE_X_LOG2 + RATE_Y_LOG2);
    for (uint i = 0u; i < count; i++)
    {
        uvec2 p = scan_sample_position(i);
        uvec2 c = uvec2(p.x >> (RATE_Y_LOG2 - SCAN_X_LOG2), p.y >> (RATE_Y_LOG2 - SCAN_Y_LOG2));
        if (all(equal(c, cell)))
            mask |= 1u << i;
    }
    return mask;
}

// The frame-buffer pixel an output pixel belongs to.
uvec2 scan_single_sampled_coord(uvec2 frag)
{
    return frag >> uvec2(SCAN_X_LOG2, SCAN_Y_LOG2);
}

#endif
