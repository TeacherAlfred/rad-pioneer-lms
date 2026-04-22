export interface MathQuestion {
  id: string;
  sector: 'numbers' | 'algebra' | 'geometry' | 'measurement' | 'data';
  level: number; // 1 (Easy) to 5 (Hard)
  question: string;
  options: string[];
  answer: string;
}

export const MATH_BANK: MathQuestion[] = [
  // ==========================================
  // SECTOR 1: NUMBERS & OPERATIONS
  // ==========================================
  { id: "num_1a", sector: "numbers", level: 1, question: "What is 45 + 55?", options: ["90", "100", "110", "105"], answer: "100" },
  { id: "num_1b", sector: "numbers", level: 1, question: "What is the place value of the 4 in 4,321?", options: ["40", "400", "4000", "4"], answer: "4000" },
  { id: "num_2a", sector: "numbers", level: 2, question: "Calculate: 345 - 120", options: ["225", "125", "205", "235"], answer: "225" },
  { id: "num_2b", sector: "numbers", level: 2, question: "What is 1/4 + 2/4?", options: ["3/8", "3/4", "2/8", "1/2"], answer: "3/4" },
  { id: "num_3a", sector: "numbers", level: 3, question: "Calculate: 125 × 12", options: ["1400", "1500", "1600", "1250"], answer: "1500" },
  { id: "num_3b", sector: "numbers", level: 3, question: "Equivalent fractions: 1/2 is equal to how many eighths?", options: ["2/8", "4/8", "6/8", "8/8"], answer: "4/8" },
  { id: "num_4a", sector: "numbers", level: 4, question: "Calculate: 450 ÷ 15", options: ["20", "25", "30", "35"], answer: "30" },
  { id: "num_4b", sector: "numbers", level: 4, question: "Sam has R200. He buys a toy for R145. How much change does he get?", options: ["R45", "R55", "R65", "R50"], answer: "R55" },
  { id: "num_5a", sector: "numbers", level: 5, question: "A pizza is cut into 5 slices. Sue eats 2/5 and Bob eats 1/5. What fraction is left?", options: ["1/5", "2/5", "3/5", "4/5"], answer: "2/5" },
  { id: "num_5b", sector: "numbers", level: 5, question: "Inverse operations: If 54 × 26 = 1404, what is 1404 ÷ 26?", options: ["26", "54", "1404", "104"], answer: "54" },

  // ==========================================
  // SECTOR 2: PATTERNS & ALGEBRA
  // ==========================================
  { id: "alg_1a", sector: "algebra", level: 1, question: "What is the next number: 2, 4, 6, 8, __?", options: ["9", "10", "12", "14"], answer: "10" },
  { id: "alg_1b", sector: "algebra", level: 1, question: "Find the missing number: 10 + __ = 25", options: ["5", "10", "15", "20"], answer: "15" },
  { id: "alg_2a", sector: "algebra", level: 2, question: "What is the next number: 5, 10, 20, 40, __?", options: ["50", "60", "80", "100"], answer: "80" },
  { id: "alg_2b", sector: "algebra", level: 2, question: "True or False: 12 + 8 is exactly the same as 8 + 12.", options: ["True", "False", "Only sometimes", "Cannot tell"], answer: "True" },
  { id: "alg_3a", sector: "algebra", level: 3, question: "Flow Diagram: Input 5 -> Multiply by 4 -> Add 2 -> What is the Output?", options: ["20", "22", "30", "11"], answer: "22" },
  { id: "alg_3b", sector: "algebra", level: 3, question: "Find the rule: 2 becomes 6. 3 becomes 9. 4 becomes 12. What is the rule?", options: ["Add 4", "Multiply by 2", "Multiply by 3", "Add 6"], answer: "Multiply by 3" },
  { id: "alg_4a", sector: "algebra", level: 4, question: "What is the next number in this pattern: 1, 4, 9, 16, __?", options: ["20", "24", "25", "30"], answer: "25" },
  { id: "alg_4b", sector: "algebra", level: 4, question: "Solve the number sentence: 45 ÷ (5 + 4) = ?", options: ["5", "9", "13", "41"], answer: "5" },
  { id: "alg_5a", sector: "algebra", level: 5, question: "Reverse Flow Diagram: Input ? -> Multiply by 6 -> Subtract 4 = Output 32.", options: ["4", "5", "6", "8"], answer: "6" },
  { id: "alg_5b", sector: "algebra", level: 5, question: "Matchstick Squares: 1 square uses 4 matches. 2 squares use 7. 3 squares use 10. How many for 4 squares?", options: ["12", "13", "14", "16"], answer: "13" },

  // ==========================================
  // SECTOR 3: SPACE & SHAPE (GEOMETRY)
  // ==========================================
  { id: "geo_1a", sector: "geometry", level: 1, question: "How many sides does a hexagon have?", options: ["5", "6", "7", "8"], answer: "6" },
  { id: "geo_1b", sector: "geometry", level: 1, question: "What 3D object looks like a party hat?", options: ["Cube", "Cylinder", "Cone", "Pyramid"], answer: "Cone" },
  { id: "geo_2a", sector: "geometry", level: 2, question: "How many flat faces does a cube have?", options: ["4", "6", "8", "12"], answer: "6" },
  { id: "geo_2b", sector: "geometry", level: 2, question: "Are all the angles in a standard square right angles?", options: ["Yes", "No", "Only two", "Only in rectangles"], answer: "Yes" },
  { id: "geo_3a", sector: "geometry", level: 3, question: "How many triangle faces are on a square-based pyramid?", options: ["2", "3", "4", "5"], answer: "4" },
  { id: "geo_3b", sector: "geometry", level: 3, question: "What is the mathematical name for a 2D shape with exactly 7 sides?", options: ["Hexagon", "Heptagon", "Octagon", "Pentagon"], answer: "Heptagon" },
  { id: "geo_4a", sector: "geometry", level: 4, question: "If you fold a paper net consisting of 6 identical squares, what 3D object do you get?", options: ["Rectangular Prism", "Square Pyramid", "Cube", "Cylinder"], answer: "Cube" },
  { id: "geo_4b", sector: "geometry", level: 4, question: "Sliding a shape across a page without turning it is called a...?", options: ["Reflection", "Rotation", "Translation", "Tessellation"], answer: "Translation" },
  { id: "geo_5a", sector: "geometry", level: 5, question: "How many edges does a rectangular prism have?", options: ["8", "10", "12", "16"], answer: "12" },
  { id: "geo_5b", sector: "geometry", level: 5, question: "Which shape transformation acts exactly like a mirror?", options: ["Translation", "Rotation", "Reflection", "Tessellation"], answer: "Reflection" },

  // ==========================================
  // SECTOR 4: MEASUREMENT
  // ==========================================
  { id: "mea_1a", sector: "measurement", level: 1, question: "How many minutes are there in exactly one hour?", options: ["24", "60", "100", "120"], answer: "60" },
  { id: "mea_1b", sector: "measurement", level: 1, question: "What instrument do we use to measure temperature?", options: ["Ruler", "Scale", "Thermometer", "Protractor"], answer: "Thermometer" },
  { id: "mea_2a", sector: "measurement", level: 2, question: "Convert 2 kilograms (kg) into grams (g).", options: ["20g", "200g", "2000g", "20000g"], answer: "2000g" },
  { id: "mea_2b", sector: "measurement", level: 2, question: "1.5 litres is equal to how many millilitres?", options: ["150ml", "1050ml", "1500ml", "15000ml"], answer: "1500ml" },
  { id: "mea_3a", sector: "measurement", level: 3, question: "A rugby match starts at 14:30 and lasts 80 minutes. What time does it end?", options: ["15:10", "15:30", "15:50", "16:00"], answer: "15:50" },
  { id: "mea_3b", sector: "measurement", level: 3, question: "What is the perimeter of a rectangle that is 5cm long and 3cm wide?", options: ["8cm", "15cm", "16cm", "30cm"], answer: "16cm" },
  { id: "mea_4a", sector: "measurement", level: 4, question: "Convert 4500 metres into kilometres.", options: ["4.5km", "45km", "450km", "0.45km"], answer: "4.5km" },
  { id: "mea_4b", sector: "measurement", level: 4, question: "If 1 bag of sugar has a mass of 2.5kg, what is the mass of 4 bags?", options: ["5kg", "7.5kg", "10kg", "12.5kg"], answer: "10kg" },
  { id: "mea_5a", sector: "measurement", level: 5, question: "A bottle holds 2L. Sue drinks 500ml. Bob drinks 750ml. How much is left?", options: ["250ml", "500ml", "750ml", "1000ml"], answer: "750ml" },
  { id: "mea_5b", sector: "measurement", level: 5, question: "A room is 4m long and 5m wide. How many 1m square tiles will cover the floor exactly?", options: ["9 tiles", "18 tiles", "20 tiles", "40 tiles"], answer: "20 tiles" },

  // ==========================================
  // SECTOR 5: DATA HANDLING
  // ==========================================
  { id: "dat_1a", sector: "data", level: 1, question: "In tally marks, what does a group of 4 vertical lines with 1 diagonal strike mean?", options: ["4", "5", "6", "10"], answer: "5" },
  { id: "dat_1b", sector: "data", level: 1, question: "What type of graph uses pictures or symbols to show data?", options: ["Bar Graph", "Pie Chart", "Line Graph", "Pictograph"], answer: "Pictograph" },
  { id: "dat_2a", sector: "data", level: 2, question: "If one picture of a car on a graph equals 10 cars, what do 3 car pictures represent?", options: ["3 cars", "13 cars", "30 cars", "300 cars"], answer: "30 cars" },
  { id: "dat_2b", sector: "data", level: 2, question: "What is the 'mode' of a set of data?", options: ["The biggest number", "The smallest number", "The middle number", "The most frequent number"], answer: "The most frequent number" },
  { id: "dat_3a", sector: "data", level: 3, question: "Find the mode of this set: 2, 4, 4, 5, 7, 4, 8", options: ["2", "4", "5", "8"], answer: "4" },
  { id: "dat_3b", sector: "data", level: 3, question: "In a pie chart, half is red, a quarter is blue, and a quarter is green. What fraction is red?", options: ["1/4", "1/3", "1/2", "3/4"], answer: "1/2" },
  { id: "dat_4a", sector: "data", level: 4, question: "A bar graph shows 25 dogs, 15 cats, and 10 birds. How many animals are there in total?", options: ["40", "45", "50", "60"], answer: "50" },
  { id: "dat_4b", sector: "data", level: 4, question: "A spinner has 4 equal sections: Red, Blue, Green, Yellow. What is the chance of landing on Red?", options: ["1 in 2", "1 in 3", "1 in 4", "1 in 5"], answer: "1 in 4" },
  { id: "dat_5a", sector: "data", level: 5, question: "In a pictograph, 1 symbol = 50 people. How many symbols do you need to show 225 people?", options: ["4 symbols", "4.5 symbols", "5 symbols", "5.5 symbols"], answer: "4.5 symbols" },
  { id: "dat_5b", sector: "data", level: 5, question: "Find the mode in this set of numbers: 12, 15, 12, 18, 15, 12, 20", options: ["12", "15", "18", "20"], answer: "12" }
];