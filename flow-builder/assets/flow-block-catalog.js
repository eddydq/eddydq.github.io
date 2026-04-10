globalThis.FLOW_EMBEDDED_CATALOG = {
  "blocks": [
    {
      "firmware_block_id": 1,
      "block_id": "source.lis3dh",
      "name": "LIS3DH Source",
      "group": "source",
      "inputs": [],
      "outputs": [
        {
          "name": "primary",
          "kind": "series"
        }
      ],
      "params": [
        {
          "name": "sample_rate_hz",
          "type": "enum",
          "default": "100",
          "enum_values": ["1", "10", "25", "50", "100", "200", "400"]
        },
        {
          "name": "axis",
          "type": "enum",
          "default": "z",
          "enum_values": ["x", "y", "z", "magnitude"]
        }
      ],
      "stateful": true
    },
    {
      "firmware_block_id": 2,
      "block_id": "source.mpu6050",
      "name": "MPU6050 Source",
      "group": "source",
      "inputs": [],
      "outputs": [
        {
          "name": "primary",
          "kind": "series"
        }
      ],
      "params": [
        {
          "name": "sample_rate_hz",
          "type": "enum",
          "default": "100",
          "enum_values": ["4", "10", "25", "50", "100", "200", "400", "1000"]
        },
        {
          "name": "axis",
          "type": "enum",
          "default": "z",
          "enum_values": ["x", "y", "z", "magnitude"]
        }
      ],
      "stateful": true
    },
    {
      "firmware_block_id": 3,
      "block_id": "source.polar",
      "name": "Polar Source",
      "group": "source",
      "inputs": [],
      "outputs": [
        {
          "name": "primary",
          "kind": "series"
        }
      ],
      "params": [
        {
          "name": "sample_rate_hz",
          "type": "int",
          "default": 52,
          "min": 52,
          "max": 52,
          "enum_values": []
        },
        {
          "name": "axis",
          "type": "enum",
          "default": "z",
          "enum_values": ["x", "y", "z", "magnitude"]
        }
      ],
      "stateful": true
    },

    {
      "firmware_block_id": 6,
      "block_id": "pretraitement.hpf_gravity",
      "name": "High-pass Gravity",
      "group": "pretraitement",
      "inputs": [
        {
          "name": "source",
          "kinds": [
            "series"
          ],
          "cardinality": "one"
        }
      ],
      "outputs": [
        {
          "name": "primary",
          "kind": "series"
        }
      ],
      "params": [
        {
          "name": "cutoff_hz",
          "type": "int",
          "default": 1,
          "min": 1,
          "max": 255,
          "enum_values": []
        },
        {
          "name": "order",
          "type": "int",
          "default": 1,
          "min": 1,
          "max": 4,
          "enum_values": []
        }
      ],
      "stateful": true
    },
    {
      "firmware_block_id": 7,
      "block_id": "pretraitement.lowpass",
      "name": "Low-pass",
      "group": "pretraitement",
      "inputs": [
        {
          "name": "source",
          "kinds": [
            "series"
          ],
          "cardinality": "one"
        }
      ],
      "outputs": [
        {
          "name": "primary",
          "kind": "series"
        }
      ],
      "params": [
        {
          "name": "cutoff_hz",
          "type": "int",
          "default": 1,
          "min": 1,
          "max": 255,
          "enum_values": []
        },
        {
          "name": "order",
          "type": "int",
          "default": 1,
          "min": 1,
          "max": 4,
          "enum_values": []
        }
      ],
      "stateful": true
    },
    {
      "firmware_block_id": 8,
      "block_id": "estimation.autocorrelation",
      "name": "Autocorrelation",
      "group": "estimation",
      "inputs": [
        {
          "name": "source",
          "kinds": [
            "series"
          ],
          "cardinality": "one"
        }
      ],
      "outputs": [
        {
          "name": "primary",
          "kind": "candidate"
        }
      ],
      "params": [
        {
          "name": "min_lag_samples",
          "type": "int",
          "default": 15,
          "min": 1,
          "max": 512,
          "enum_values": []
        },
        {
          "name": "max_lag_samples",
          "type": "int",
          "default": 160,
          "min": 2,
          "max": 512,
          "enum_values": []
        },
        {
          "name": "confidence_min",
          "type": "int",
          "default": 0,
          "min": 0,
          "max": 100,
          "enum_values": []
        },
        {
          "name": "harmonic_pct",
          "type": "int",
          "default": 80,
          "min": 0,
          "max": 100,
          "enum_values": []
        }
      ],
      "stateful": false
    },
    {
      "firmware_block_id": 9,
      "block_id": "estimation.fft_dominant",
      "name": "FFT Dominant",
      "group": "estimation",
      "inputs": [
        {
          "name": "source",
          "kinds": [
            "series"
          ],
          "cardinality": "one"
        }
      ],
      "outputs": [
        {
          "name": "primary",
          "kind": "candidate"
        }
      ],
      "params": [
        {
          "name": "min_hz",
          "type": "int",
          "default": 0,
          "min": 0,
          "max": 255,
          "enum_values": []
        },
        {
          "name": "max_hz",
          "type": "int",
          "default": 5,
          "min": 1,
          "max": 255,
          "enum_values": []
        },
        {
          "name": "window_type",
          "type": "int",
          "default": 0,
          "min": 0,
          "max": 3,
          "enum_values": []
        }
      ],
      "stateful": false
    },
    {
      "firmware_block_id": 10,
      "block_id": "detection.adaptive_peak_detect",
      "name": "Adaptive Peak Detect",
      "group": "detection",
      "inputs": [
        {
          "name": "source",
          "kinds": [
            "series"
          ],
          "cardinality": "one"
        }
      ],
      "outputs": [
        {
          "name": "primary",
          "kind": "candidate"
        }
      ],
      "params": [
        {
          "name": "threshold_factor",
          "type": "int",
          "default": 8,
          "min": 0,
          "max": 255,
          "enum_values": []
        },
        {
          "name": "min_distance_samples",
          "type": "int",
          "default": 5,
          "min": 1,
          "max": 512,
          "enum_values": []
        },
        {
          "name": "decay_rate",
          "type": "int",
          "default": 200,
          "min": 0,
          "max": 255,
          "enum_values": []
        }
      ],
      "stateful": true
    },
    {
      "firmware_block_id": 11,
      "block_id": "detection.zero_crossing_detect",
      "name": "Zero Crossing Detect",
      "group": "detection",
      "inputs": [
        {
          "name": "source",
          "kinds": [
            "series"
          ],
          "cardinality": "one"
        }
      ],
      "outputs": [
        {
          "name": "primary",
          "kind": "candidate"
        }
      ],
      "params": [
        {
          "name": "hysteresis",
          "type": "int",
          "default": 50,
          "min": -32768,
          "max": 32767,
          "enum_values": []
        },
        {
          "name": "min_interval_samples",
          "type": "int",
          "default": 5,
          "min": 1,
          "max": 512,
          "enum_values": []
        }
      ],
      "stateful": false
    },
    {
      "firmware_block_id": 12,
      "block_id": "validation.spm_range_gate",
      "name": "SPM Range Gate",
      "group": "validation",
      "inputs": [
        {
          "name": "source",
          "kinds": [
            "candidate"
          ],
          "cardinality": "one"
        }
      ],
      "outputs": [
        {
          "name": "accepted",
          "kind": "candidate"
        }
      ],
      "params": [
        {
          "name": "min_spm",
          "type": "int",
          "default": 30,
          "min": 0,
          "max": 255,
          "enum_values": []
        },
        {
          "name": "max_spm",
          "type": "int",
          "default": 200,
          "min": 0,
          "max": 255,
          "enum_values": []
        }
      ],
      "stateful": false
    },
    {
      "firmware_block_id": 13,
      "block_id": "validation.peak_selector",
      "name": "Peak Selector",
      "group": "validation",
      "inputs": [
        {
          "name": "candidate",
          "kinds": [
            "candidate"
          ],
          "cardinality": "one"
        },
        {
          "name": "series",
          "kinds": [
            "series"
          ],
          "cardinality": "one"
        }
      ],
      "outputs": [
        {
          "name": "primary",
          "kind": "candidate"
        }
      ],
      "params": [
        {
          "name": "min_prominence",
          "type": "int",
          "default": 0,
          "min": -32768,
          "max": 32767,
          "enum_values": []
        },
        {
          "name": "min_distance",
          "type": "int",
          "default": 1,
          "min": 1,
          "max": 512,
          "enum_values": []
        }
      ],
      "stateful": false
    },
    {
      "firmware_block_id": 14,
      "block_id": "validation.confidence_gate",
      "name": "Confidence Gate",
      "group": "validation",
      "inputs": [
        {
          "name": "source",
          "kinds": [
            "candidate"
          ],
          "cardinality": "one"
        }
      ],
      "outputs": [
        {
          "name": "accepted",
          "kind": "candidate"
        },
        {
          "name": "rejected",
          "kind": "candidate"
        }
      ],
      "params": [
        {
          "name": "min_confidence",
          "type": "int",
          "default": 0,
          "min": 0,
          "max": 100,
          "enum_values": []
        },
        {
          "name": "fallback_value",
          "type": "int",
          "default": 0,
          "min": -32768,
          "max": 32767,
          "enum_values": []
        }
      ],
      "stateful": false
    },
    {
      "firmware_block_id": 15,
      "block_id": "suivi.kalman_2d",
      "name": "Kalman 2D",
      "group": "suivi",
      "inputs": [
        {
          "name": "source",
          "kinds": [
            "candidate"
          ],
          "cardinality": "one"
        }
      ],
      "outputs": [
        {
          "name": "primary",
          "kind": "estimate"
        }
      ],
      "params": [
        {
          "name": "q",
          "type": "int",
          "default": 256,
          "min": 1,
          "max": 65535,
          "enum_values": []
        },
        {
          "name": "r",
          "type": "int",
          "default": 256,
          "min": 1,
          "max": 65535,
          "enum_values": []
        },
        {
          "name": "p_max",
          "type": "int",
          "default": 10000,
          "min": 1,
          "max": 65535,
          "enum_values": []
        },
        {
          "name": "max_jump",
          "type": "int",
          "default": 20,
          "min": 0,
          "max": 255,
          "enum_values": []
        }
      ],
      "stateful": true
    },
    {
      "firmware_block_id": 16,
      "block_id": "suivi.confirmation_filter",
      "name": "Confirmation Filter",
      "group": "suivi",
      "inputs": [
        {
          "name": "source",
          "kinds": [
            "estimate"
          ],
          "cardinality": "one"
        }
      ],
      "outputs": [
        {
          "name": "final",
          "kind": "estimate"
        }
      ],
      "params": [
        {
          "name": "required_count",
          "type": "int",
          "default": 3,
          "min": 1,
          "max": 255,
          "enum_values": []
        },
        {
          "name": "tolerance_pct",
          "type": "int",
          "default": 10,
          "min": 0,
          "max": 100,
          "enum_values": []
        }
      ],
      "stateful": true
    }
  ]
}
;
