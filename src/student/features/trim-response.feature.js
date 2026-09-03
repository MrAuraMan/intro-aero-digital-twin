import {
  calculateCm,
  calculateTrimAngleDeg,
  calculateDeltaCm,
  classifyDisturbance,
  calculateTrimResponse
} from "../physics/trim-response.js";

const REQUIRED_CAPABILITY = {
  id: "loads.pitch.component-sum",
  version: 1
};

function hasRequiredCapability(capabilities) {
  if (!capabilities) {
    return false;
  }

  const capability = capabilities[REQUIRED_CAPABILITY.id];

  if (!capability) {
    return false;
  }

  if (typeof capability === "number") {
    return capability >= REQUIRED_CAPABILITY.version;
  }

  return capability.version >= REQUIRED_CAPABILITY.version;
}

function getCapabilities(context) {
  return context?.capabilities ?? {};
}

export const feature = {
  contractVersion: 4,
  id: "trim-response",
  title: "Live Cm–alpha relationship and trim",
  description:
    "Evaluate the linear pitching-moment relationship, trim condition, and local disturbance tendency.",
  category: "Stability · Student feature",
  learningMode: "concept",
  topicId: "stability",
  inputKeys: [
    "cm0",
    "cmAlphaPerRad",
    "angleOfAttackDeg",
    "disturbanceAlphaDeg"
  ],
  requiresCapabilities: [
    {
      id: "loads.pitch.component-sum",
      version: 1
    }
  ],
  providesCapabilities: [
    {
      id: "stability.pitch.cm-alpha",
      version: 1
    }
  ],
  assumptions: [
    "The Cm-alpha relationship is linear over the investigated range.",
    "The model is quasi-static and represents a small disturbance about the selected condition.",
    "Cm0 and Cm_alpha represent the same aircraft configuration and flight condition.",
    "Positive pitching moment and positive angle of attack are nose-up."
  ],
  validityLimits: [
    "Do not use the linear relationship at stall, at large angle of attack, or where aerodynamic coefficients are strongly nonlinear.",
    "The model does not calculate a time history, damping, control motion, or handling quality.",
    "A restoring tendency is not proof of acceptable safety, controllability, or flightworthiness.",
    "The calculated trim angle is meaningful only when the linear model remains valid at that angle."
  ],
  simulation: {
    display: "analysis-only",
    durationS: 1,
    initialState: {},
    controls: {},
    disturbance: {}
  },

  analyze(aircraft, capabilityContext) {
    const capabilities = getCapabilities(capabilityContext);

    if (!hasRequiredCapability(capabilities)) {
      return {
        results: [],
        verificationCases: [],
        decision: {
          question:
            "At the selected angle of attack, is the simplified pitching-moment model trimmed, and does a small angle-of-attack disturbance create a restoring moment tendency?",
          interpretation:
            "The required earlier longitudinal moment-contribution capability is not available, so this Stage 4 feature remains locked.",
          status: "neutral"
        },
        plots: [],
        scene: null
      };
    }

    const {
      cm0,
      cmAlphaPerRad,
      angleOfAttackDeg,
      disturbanceAlphaDeg
    } = aircraft;

    const response = calculateTrimResponse({
      cm0,
      cmAlphaPerRad,
      angleOfAttackDeg,
      disturbanceAlphaDeg
    });

    const trimAngleResult =
      response.trimAngleDeg === null
        ? {
            label: "Trim angle",
            value: "not available",
            unit: "deg",
            precision: 2
          }
        : {
            label: "Trim angle",
            value: response.trimAngleDeg,
            unit: "deg",
            precision: 2
          };

    const plotStartDeg = Math.min(-10, angleOfAttackDeg);
    const plotEndDeg = Math.max(10, angleOfAttackDeg);
    const plotStepDeg = 0.5;
    const points = [];

    for (
      let angleDeg = plotStartDeg;
      angleDeg <= plotEndDeg + plotStepDeg / 2;
      angleDeg += plotStepDeg
    ) {
      const value = calculateCm(
        cm0,
        cmAlphaPerRad,
        angleDeg
      );

      points.push({
        x: Number(angleDeg.toFixed(10)),
        y: value
      });
    }

    return {
      results: [
        {
          label: "Pitching-moment coefficient, Cm(alpha)",
          value: response.cm,
          unit: "",
          precision: 7,
          emphasis: true
        },
        trimAngleResult,
        {
          label: "Disturbance moment-coefficient change, delta_Cm",
          value: response.deltaCm,
          unit: "",
          precision: 7
        },
        {
          label: "Selected condition",
          value: response.trimmed ? "trimmed" : "not trimmed",
          unit: "",
          precision: 0
        },
        {
          label: "Disturbance tendency",
          value: response.tendency,
          unit: "",
          precision: 0
        }
      ],

      verificationCases: [
        {
          id: "numerical",
          name: "Reference numerical case",
          passed:
            Math.abs(
              calculateCm(0.04, -0.8, 2.86) -
                0.0000668667
            ) <= 1e-9 &&
            Math.abs(
              calculateDeltaCm(-0.8, 2.0) -
                -0.027925268
            ) <= 1e-9 &&
            calculateTrimResponse({
              cm0: 0.04,
              cmAlphaPerRad: -0.8,
              angleOfAttackDeg: 2.86,
              disturbanceAlphaDeg: 2.0
            }).trimmed === false &&
            classifyDisturbance(
              2.0,
              calculateDeltaCm(-0.8, 2.0)
            ) === "restoring"
        },
        {
          id: "behavioral",
          name: "Reversed disturbance",
          passed:
            calculateDeltaCm(-0.8, -2.0) > 0 &&
            classifyDisturbance(
              -2.0,
              calculateDeltaCm(-0.8, -2.0)
            ) === "restoring"
        },
        {
          id: "boundary",
          name: "Zero slope",
          passed:
            calculateTrimAngleDeg(0.04, 0) === null &&
            calculateDeltaCm(0, 2.0) === 0 &&
            classifyDisturbance(2.0, 0) === "neutral"
        }
      ],

      decision: {
        question:
          "At the selected angle of attack, is the simplified pitching-moment model trimmed, and does a small angle-of-attack disturbance create a restoring moment tendency?",
        interpretation: response.trimmed
          ? `The selected condition is trimmed within the specified tolerance, and the disturbance has a ${response.tendency} tendency under the linear quasi-static model.`
          : `The selected condition is not trimmed under the specified tolerance, and the disturbance has a ${response.tendency} tendency under the linear quasi-static model.`,
        status: response.tendency === "destabilizing"
          ? "caution"
          : response.tendency === "restoring"
            ? "pass"
            : "neutral"
      },

      plots: [
        {
          type: "line",
          title: "Cm–alpha relationship",
          xAxis: {
            label: "Angle of attack",
            unit: "deg"
          },
          yAxis: {
            label: "Pitching-moment coefficient",
            unit: ""
          },
          series: [
            {
              label: "Cm(alpha)",
              points
            }
          ],
          regions: [],
          referenceLines: [
            {
              axis: "y",
              value: 0,
              label: "Trim line: Cm = 0"
            }
          ]
        }
      ],

      scene: null
    };
  }
};

export const model = {
  kind: "derived",

  evaluate(runtimeContext) {
    const capabilities = getCapabilities(runtimeContext);

    if (!hasRequiredCapability(capabilities)) {
      return {
        values: {}
      };
    }

    const aircraft = runtimeContext.aircraft;

    const response = calculateTrimResponse({
      cm0: aircraft.cm0,
      cmAlphaPerRad: aircraft.cmAlphaPerRad,
      angleOfAttackDeg: aircraft.angleOfAttackDeg,
      disturbanceAlphaDeg: aircraft.disturbanceAlphaDeg
    });

    return {
      values: {
        cm: response.cm,
        trimAngleDeg: response.trimAngleDeg,
        deltaCm: response.deltaCm,
        trimmed: response.trimmed,
        tendency: response.tendency,
        alphaRad: response.alphaRad,
        deltaAlphaRad: response.deltaAlphaRad
      }
    };
  }
};